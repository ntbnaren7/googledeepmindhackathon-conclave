export class AudioRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onAudioChunk: ((buffer: ArrayBuffer) => void) | null = null;
  private isRecording = false;

  constructor(onAudioChunk: (buffer: ArrayBuffer) => void) {
    this.onAudioChunk = onAudioChunk;
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Gemini Live expects 16kHz
      this.context = new AudioContext({ sampleRate: 16000 });
      this.source = this.context.createMediaStreamSource(this.stream);
      
      // 4096 buffer size, 1 input channel, 1 output channel
      this.processor = this.context.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1, 1] to Int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (this.onAudioChunk) {
          this.onAudioChunk(pcm16.buffer);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.isRecording = true;
      // eslint-disable-next-line no-console
      console.log('[audio-recorder] Started recording at 16000Hz');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audio-recorder] Failed to start:', err);
      throw err;
    }
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    
    // eslint-disable-next-line no-console
    console.log('[audio-recorder] Stopped recording');
  }

  get isRunning(): boolean {
    return this.isRecording;
  }
}
