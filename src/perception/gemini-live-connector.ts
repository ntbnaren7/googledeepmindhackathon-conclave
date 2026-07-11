import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import type { IGeminiLiveConnector } from './interfaces';
import type { AudioChunk, RawTranscript } from './types';
import { logger } from '@shared/logger';

/** Default Live-capable model used when the configured one isn't a Live model. */
const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 500;

/**
 * The expert council system instruction.
 *
 * This is injected into the Live session once at connect time. The Live model
 * NATIVELY handles interruption timing — it hears audio continuously and
 * decides when to speak without waiting for any server-side pipeline.
 *
 * Override via COUNCIL_SYSTEM_INSTRUCTION env var or by passing systemInstruction
 * to GeminiLiveConnectorOptions.
 */
const DEFAULT_SYSTEM_INSTRUCTION = `You are a real-time expert council observing a live business meeting. You consist of four distinct voices:

**CTO (Alex):** Pragmatic engineering lead. Has seen startups fail from over-engineering. Terse — asks one sharp question instead of lecturing. Only speaks when a technical claim is factually wrong, a timeline is unrealistic, or a decision creates irreversible technical debt. Example: "Wait — Kubernetes isn't a 2-week migration. With our current stack that's 3-4 months minimum."

**Finance (Sarah):** Ex-banker. Converts every idea into a number. Only speaks when spend is discussed without ROI, or a financial assumption has no source. Always ends with a number. Example: "Hold on — what's the actual cost? This would add $8-12k per month based on current usage."

**Product (Maya):** Obsessed with the smallest thing that proves a hypothesis. Only speaks when a feature is being scoped without a specific user problem, or when scope creep disguised as user need appears. Example: "Which user asked for this? Do we have signal from actual customers or are we building for someone we imagined?"

**Research (Raj):** Former academic. Has a low tolerance for decisions without evidence. Only speaks when a major assumption is treated as fact, or when he knows a directly comparable case study. Example: "Before we commit — three companies tried this in 2022. Two succeeded, one failed specifically on enterprise adoption. Should I pull that up?"

## Critical Rules
1. **Default is silence.** Do not speak unless you have something genuinely important that changes the decision.
2. **One voice at a time.** Pick the most relevant expert for the moment.
3. **Always announce who is speaking** at the start: "CTO: ..." or "Finance: ..." etc.
4. **Interrupt immediately** when you hear something that triggers your domain — do not wait for the human to finish their sentence if the concern is urgent.
5. **Be brief.** Maximum 2 sentences. This is a meeting interruption, not a presentation.
6. **No filler.** Never say "Great point" or "That's interesting." React to the substance.
7. **React to what was just said**, not to the topic in general. Quote the specific claim if it helps.

The human will be speaking in a business meeting. Listen continuously. Speak up only when your expertise is directly needed to prevent a mistake or fill a critical gap.`;


export interface GeminiLiveConnectorOptions {
  apiKey: string;
  /** Live-capable model (e.g. gemini-live-2.5-flash-preview). */
  model: string;
  /** Input audio sample rate (Live API expects 16000). */
  sampleRate: number;
  /**
   * System instruction passed to the Live session.
   * This defines the model's personality and behaviour for the entire session.
   * Should be the full expert-council persona for real-time agent interruption.
   */
  systemInstruction?: string;
}

type TranscriptHandler = (raw: RawTranscript) => void;
type AudioResponseHandler = (buffer: ArrayBuffer) => void;

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
  private readonly systemInstruction: string;
  private session: Session | null = null;
  private connected = false;
  private closing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private transcriptHandler: TranscriptHandler | null = null;
  private audioResponseHandler: AudioResponseHandler | null = null;
  private disconnectHandler: (() => void) | null = null;
  private interruptHandler: (() => void) | null = null;
  /** Accumulates interim input-transcription text until a turn completes. */
  private buffer = '';
  private bufferStartMs = 0;

  constructor(options: GeminiLiveConnectorOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = this.resolveModel(options.model);
    this.sampleRate = options.sampleRate;
    this.systemInstruction = options.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION;
  }

  onTranscript(handler: TranscriptHandler): void {
    this.transcriptHandler = handler;
  }

  onAudioResponse(handler: AudioResponseHandler): void {
    this.audioResponseHandler = handler;
  }

  onInterrupt(handler: () => void): void {
    this.interruptHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  async connect(): Promise<void> {
    this.closing = false;
    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          // The model responds with AUDIO — we capture it and pipe it to clients.
          responseModalities: [Modality.AUDIO],
          // Transcribe what the HUMAN says (input transcription).
          inputAudioTranscription: {},
          // Also transcribe what the MODEL says — lets us log which expert spoke.
          outputAudioTranscription: {},
          systemInstruction: this.systemInstruction,
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
          onclose: (e: unknown) => {
            this.connected = false;
            this.session = null;
            // e is a WebSocket CloseEvent
            const evt = e as { code?: number; reason?: string; wasClean?: boolean } | null;
            logger.warn('[gemini-live] session closed', {
              code: evt?.code ?? 'n/a',
              reason: evt?.reason || '(none)',
              wasClean: evt?.wasClean ?? false,
            });
            this.disconnectHandler?.();
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

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Inject agent text as a client turn so the model speaks it back as audio.
   * This is how agent proposals get voiced through the Live session.
   */
  sendText(text: string): void {
    if (!this.session || !this.connected) {
      logger.warn('[gemini-live] sendText called while disconnected; dropping', { text: text.slice(0, 50) });
      return;
    }
    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
      logger.debug('[gemini-live] text injected for agent speech', { chars: text.length });
    } catch (error) {
      logger.error('[gemini-live] sendClientContent failed', { error: String(error) });
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

  /** Extracts input transcription and audio response, fires the respective handlers. */
  private handleMessage(message: LiveServerMessage): void {
    const content = message.serverContent;
    if (!content) return;

    // INTERRUPTED — user spoke and the Live model stopped mid-sentence.
    // Notify the browser immediately so it can stop playing buffered audio.
    if ((content as unknown as { interrupted?: boolean }).interrupted) {
      logger.info('[gemini-live] model interrupted by user speech');
      this.interruptHandler?.();
    }

    // INPUT TRANSCRIPTION — what the human said
    const text = content.inputTranscription?.text;
    if (text) {
      if (this.buffer === '') this.bufferStartMs = Date.now();
      this.buffer += text;
      this.emit(this.buffer, false);
    }
    if (content.turnComplete && this.buffer !== '') {
      this.emit(this.buffer, true);
      this.buffer = '';
    }

    // AUDIO RESPONSE — what the model says back
    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const inline = (part as { inlineData?: { data: string; mimeType: string } }).inlineData;
      if (inline?.data) {
        const raw = Buffer.from(inline.data, 'base64');
        this.audioResponseHandler?.(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
      }
    }

    // OUTPUT TRANSCRIPTION — what the model said (text version of its audio)
    // Lets us log which expert spoke and what they said.
    const outputText = (content as unknown as { outputTranscription?: { text?: string } }).outputTranscription?.text;
    if (outputText?.trim()) {
      logger.info('[council] expert spoke', { text: outputText.trim() });
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
