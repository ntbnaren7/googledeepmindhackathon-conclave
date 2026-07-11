import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import type { IGeminiLiveConnector } from './interfaces';
import type { AudioChunk, RawTranscript } from './types';
import { logger } from '@shared/logger';

/** Default Live-capable model used when the configured one isn't a Live model. */
const DEFAULT_LIVE_MODEL = 'gemini-live-2.5-flash-preview';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 500;

export interface GeminiLiveConnectorOptions {
  apiKey: string;
  /** Live-capable model (e.g. gemini-live-2.5-flash-preview). */
  model: string;
  /** Input audio sample rate (Live API expects 16000). */
  sampleRate: number;
}

type TranscriptHandler = (raw: RawTranscript) => void;

/**
 * Real connector to the Gemini Live API via the @google/genai SDK.
 *
 * We stream raw 16-bit PCM audio and read the model's INPUT transcription
 * (`serverContent.inputTranscription`) — i.e. a transcription of what the human
 * said. The model's own responses are ignored; a system instruction keeps it
 * silent. Speaker diarization is not provided by input transcription, so the
 * DiarizationTracker attributes segments (PRD NG7). Runs server-side (Node) so
 * the API key stays off the client.
 *
 * Robustness: connection failures are caught, logged, and retried with
 * exponential backoff; errors never propagate up to crash the pipeline (R1/R3).
 */
export class GeminiLiveConnector implements IGeminiLiveConnector {
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly sampleRate: number;
  private session: Session | null = null;
  private connected = false;
  private closing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private transcriptHandler: TranscriptHandler | null = null;
  /** Accumulates interim input-transcription text until a turn completes. */
  private buffer = '';
  private bufferStartMs = 0;

  constructor(options: GeminiLiveConnectorOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = this.resolveModel(options.model);
    this.sampleRate = options.sampleRate;
  }

  onTranscript(handler: TranscriptHandler): void {
    this.transcriptHandler = handler;
  }

  async connect(): Promise<void> {
    this.closing = false;
    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          // We only need transcription; keep responses cheap and silent.
          responseModalities: [Modality.TEXT],
          inputAudioTranscription: {},
          systemInstruction:
            'You are a silent transcription service. Never reply. Output nothing.',
        },
        callbacks: {
          onopen: () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            logger.info('[gemini-live] connected', { model: this.model });
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (error: unknown) => {
            logger.error('[gemini-live] socket error', { error: String(error) });
          },
          onclose: () => {
            this.connected = false;
            this.session = null;
            if (!this.closing) this.scheduleReconnect();
          },
        },
      });
    } catch (error) {
      this.connected = false;
      logger.error('[gemini-live] connect failed', { error: String(error) });
      this.scheduleReconnect();
    }
  }

  streamAudio(chunk: AudioChunk): void {
    if (!this.session || !this.connected) return;
    try {
      const data = Buffer.from(new Uint8Array(chunk.data)).toString('base64');
      this.session.sendRealtimeInput({
        audio: { data, mimeType: `audio/pcm;rate=${this.sampleRate}` },
      });
    } catch (error) {
      logger.error('[gemini-live] sendRealtimeInput failed', {
        error: String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.session?.close();
    } catch (error) {
      logger.warn('[gemini-live] close error', { error: String(error) });
    }
    this.session = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Extracts input transcription and emits RawTranscript fragments. */
  private handleMessage(message: LiveServerMessage): void {
    const content = message.serverContent;
    if (!content) return;

    const text = content.inputTranscription?.text;
    if (text) {
      if (this.buffer === '') this.bufferStartMs = Date.now();
      this.buffer += text;
      // Interim update — lets the UI show live typing.
      this.emit(this.buffer, false);
    }

    if (content.turnComplete && this.buffer !== '') {
      this.emit(this.buffer, true);
      this.buffer = '';
    }
  }

  private emit(text: string, isFinal: boolean): void {
    if (!this.transcriptHandler) return;
    const now = Date.now();
    const raw: RawTranscript = {
      text,
      isFinal,
      // The Live API does not give per-fragment timestamps; approximate.
      startMs: this.bufferStartMs || now,
      endMs: now,
    };
    this.transcriptHandler(raw);
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[gemini-live] max reconnect attempts reached; giving up');
      return;
    }
    const delay = BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts;
    this.reconnectAttempts += 1;
    logger.warn('[gemini-live] scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private resolveModel(model: string): string {
    if (!model || !model.includes('live')) {
      logger.warn('[gemini-live] configured model is not Live-capable; using default', {
        configured: model,
        using: DEFAULT_LIVE_MODEL,
      });
      return DEFAULT_LIVE_MODEL;
    }
    return model;
  }
}
