import type { IGeminiLiveConnector } from './interfaces';
import type { AudioChunk, RawTranscript } from './types';
import { logger } from '@shared/logger';

/**
 * A connector driven by external input (the browser: typed text or Web Speech
 * transcription) instead of a scripted timer or live audio. The UI sends
 * utterances over the WebSocket; the server forwards them here via `submit`,
 * which emits a final `RawTranscript` into the normal perception pipeline
 * (diarization → segment → batch → compress → DELTA_PRODUCED).
 */
export class ManualConnector implements IGeminiLiveConnector {
  private connected = false;
  private transcriptHandler: ((raw: RawTranscript) => void) | null = null;

  onTranscript(handler: (raw: RawTranscript) => void): void {
    this.transcriptHandler = handler;
  }

  async connect(): Promise<void> {
    this.connected = true;
    logger.info('[manual-connector] ready for UI-driven input');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  // No audio streaming — text arrives already transcribed via submit().
  streamAudio(_chunk: AudioChunk): void {}

  isConnected(): boolean {
    return this.connected;
  }

  /** Inject an utterance from the UI into the perception pipeline. */
  submit(speakerTag: string, text: string): void {
    const clean = text.trim();
    if (!this.connected || this.transcriptHandler === null || clean === '') return;

    const now = Date.now();
    this.transcriptHandler({
      text: clean,
      speakerTag,
      isFinal: true,
      startMs: now,
      endMs: now + clean.length * 60,
      confidence: 0.95,
    });
  }
}
