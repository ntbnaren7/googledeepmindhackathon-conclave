/**
 * AudioPlayer — plays PCM audio chunks received from the Gemini Live model.
 *
 * Gemini Live returns raw 16-bit PCM at 24000 Hz. We queue chunks into a
 * Web Audio worklet-free pipeline using AudioContext.decodeAudioData via a
 * WAV wrapper, then schedule them sequentially to avoid gaps.
 */
export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly sampleRate: number;
  /** Tracked sources so we can stop them immediately on interrupt. */
  private activeSources: AudioBufferSourceNode[] = [];

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  /** Call once to unlock the AudioContext (must be triggered by user gesture). */
  resume(): void {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: this.sampleRate });
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    // Initialise scheduling cursor.
    this.nextStartTime = this.context.currentTime;
  }

  /** Enqueue a raw PCM Int16 ArrayBuffer for gapless playback. */
  enqueue(pcm16Buffer: ArrayBuffer): void {
    if (!this.context) {
      // Auto-init on first chunk — may be blocked until user gesture in some browsers.
      this.resume();
    }
    const ctx = this.context!;

    // Convert Int16 PCM → Float32 samples.
    const int16 = new Int16Array(pcm16Buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    // Create an AudioBuffer and schedule it.
    const audioBuffer = ctx.createBuffer(1, float32.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Track the source so interrupt() can stop it.
    this.activeSources.push(source);
    source.addEventListener('ended', () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
    });

    // Schedule gaplessly after the previous chunk.
    const startAt = Math.max(ctx.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
  }

  /**
   * Immediately stop all queued and playing audio.
   * Call this when the Live model sends `interrupted: true` so the browser
   * cuts off mid-sentence just like the model did on the server.
   */
  interrupt(): void {
    // Stop every scheduled source immediately.
    for (const source of this.activeSources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.activeSources = [];
    // Reset scheduling cursor to now so next enqueue starts immediately.
    if (this.context) {
      this.nextStartTime = this.context.currentTime;
    }
  }

  stop(): void {
    this.interrupt();
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.nextStartTime = 0;
    }
  }
}
