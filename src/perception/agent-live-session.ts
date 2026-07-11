/**
 * agent-live-session.ts
 *
 * A single agent's dedicated Gemini Live session running in TEXT response mode.
 *
 * Key design decisions:
 *  - LAZY CONNECT: sessions do not connect until the first audio chunk arrives.
 *    This prevents idle session drops and mirrors the main connector's pattern.
 *  - EXPONENTIAL BACKOFF: reconnects use capped exponential backoff so a
 *    connection storm can't form.
 *  - MAX RETRIES: after MAX_RECONNECT_ATTEMPTS the session gives up and logs an
 *    error rather than looping forever.
 */

import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import type { AudioChunk } from './types';
import { logger } from '@shared/logger';
import { parseUrgencyTag } from './agent-session-personas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WantsToSpeakHandler = (agentId: string, text: string, urgency: number) => void;

export interface AgentLiveSessionOptions {
  agentId: string;
  /** Full system instruction — the agent's persona and rules. */
  systemInstruction: string;
  apiKey: string;
  model: string;
  sampleRate: number;
}

// ---------------------------------------------------------------------------
// AgentLiveSession
// ---------------------------------------------------------------------------

export class AgentLiveSession {
  readonly agentId: string;

  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly sampleRate: number;
  private readonly systemInstruction: string;

  private session: Session | null = null;
  private connected = false;
  private closing = false;
  private muted = false;

  /** Lazy connect state — mirrors the main connector. */
  private connecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Text response accumulation buffer. */
  private textBuffer = '';
  private turnFired = false;

  private wantsToSpeakHandler: WantsToSpeakHandler | null = null;

  constructor(opts: AgentLiveSessionOptions) {
    this.agentId = opts.agentId;
    this.systemInstruction = opts.systemInstruction;
    this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.sampleRate = opts.sampleRate;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  onWantsToSpeak(handler: WantsToSpeakHandler): void {
    this.wantsToSpeakHandler = handler;
  }

  mute(): void { this.muted = true; }
  unmute(): void { this.muted = false; }

  /**
   * Stream a raw audio chunk to this agent's Live session.
   * Lazily connects on the first chunk — sessions are not opened until
   * they have audio to receive, preventing immediate idle-timeout drops.
   */
  streamAudio(chunk: AudioChunk): void {
    if (this.closing) return;

    // Lazy connect on first audio chunk
    if (!this.connected && !this.connecting) {
      this.connecting = true;
      void this.connect().then(() => {
        this.connecting = false;
        // Stream the triggering chunk now that we're connected
        this.sendAudioChunk(chunk);
      }).catch(err => {
        this.connecting = false;
        logger.error(`[agent-session:${this.agentId}] lazy connect failed`, { error: String(err) });
      });
      return;
    }

    if (this.connected) {
      this.sendAudioChunk(chunk);
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try { this.session?.close(); } catch { /* ignore */ }
    this.session = null;
    this.connected = false;
    logger.debug(`[agent-session:${this.agentId}] disconnected`);
  }

  // =========================================================================
  // Private
  // =========================================================================

  private sendAudioChunk(chunk: AudioChunk): void {
    if (!this.session || !this.connected) return;
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: Buffer.from(chunk.data).toString('base64'),
          mimeType: `audio/pcm;rate=${this.sampleRate}`,
        },
      });
    } catch (err) {
      logger.warn(`[agent-session:${this.agentId}] streamAudio error`, { error: String(err) });
    }
  }

  async connect(): Promise<void> {
    if (this.closing) return;
    try {
      this.session = await this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          // Transcribe the human's audio so the agent can also read the context.
          inputAudioTranscription: {},
          // Transcribe the model's audio output into text for urgency tag parsing.
          outputAudioTranscription: {},
          systemInstruction: this.systemInstruction,
        },
        callbacks: {
          onopen: () => {
            this.connected = true;
            this.connecting = false;
            this.reconnectAttempts = 0;
            logger.info(`[agent-session:${this.agentId}] connected`);
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onerror: (err: unknown) => {
            logger.warn(`[agent-session:${this.agentId}] socket error`, { error: String(err) });
          },
          onclose: (e: unknown) => {
            this.connected = false;
            this.session = null;
            const evt = e as { code?: number; reason?: string; wasClean?: boolean } | null;
            logger.warn(`[agent-session:${this.agentId}] session closed`, {
              code: evt?.code ?? 'n/a',
              reason: evt?.reason || '(none)',
              wasClean: evt?.wasClean ?? false,
            });
            if (!this.closing) {
              this.scheduleReconnect();
            }
          },
        },
      });
    } catch (err) {
      this.connected = false;
      this.connecting = false;
      logger.error(`[agent-session:${this.agentId}] connect failed`, { error: String(err) });
      if (!this.closing) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(`[agent-session:${this.agentId}] max reconnect attempts reached; giving up`);
      return;
    }
    const delay = BASE_RECONNECT_DELAY_MS * (2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    logger.debug(`[agent-session:${this.agentId}] scheduling reconnect`, {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Only reconnect if we're not already connected/connecting
      if (!this.connected && !this.connecting && !this.closing) {
        this.connecting = true;
        void this.connect().then(() => {
          this.connecting = false;
        }).catch(() => {
          this.connecting = false;
        });
      }
    }, delay);
  }

  private handleMessage(msg: LiveServerMessage): void {
    const content = msg.serverContent;
    if (!content) return;

    // Accumulate TEXT response parts or output transcription
    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const text = (part as { text?: string }).text;
      if (text) {
        this.textBuffer += text;
      }
    }
    const outText = (content as unknown as { outputTranscription?: { text?: string } }).outputTranscription?.text;
    if (outText) {
      this.textBuffer += outText;
    }

    // Fire immediately on first meaningful speech chunk or urgency tag
    // Do NOT wait for turnComplete — we want instant mid-speech interruption!
    if (!this.turnFired && this.textBuffer.trim().length >= 10) {
      const rawText = this.textBuffer.trim();
      const { text, urgency } = parseUrgencyTag(rawText);

      if (!this.muted && this.wantsToSpeakHandler) {
        this.turnFired = true;
        logger.debug(`[agent-session:${this.agentId}] fast interrupt triggered`, {
          urgency,
          text: text.slice(0, 80),
        });
        this.wantsToSpeakHandler(this.agentId, text, urgency);
      } else if (this.muted) {
        logger.debug(`[agent-session:${this.agentId}] muted — proposal suppressed`);
      }
    }

    // On turn complete, reset buffer and turnFired for the next turn
    if (content.turnComplete) {
      this.textBuffer = '';
      this.turnFired = false;
    }
  }
}
