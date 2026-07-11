import { IAgentResponse, ISpeechToken } from "@shared/types";
import { logger } from "@shared/logger";
import { ISpeechOutput } from "./interfaces";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the speech synthesizer. */
export interface SpeechSynthesizerConfig {
  /** Speech rate multiplier (0.5 = slow, 1.0 = normal, 2.0 = fast). */
  rate?: number;
  /** Volume multiplier (0.0 = silent, 1.0 = normal). */
  volume?: number;
  /** Voice name or ID (provider-specific). */
  voice?: string;
  /** Language code (e.g., "en-US"). */
  lang?: string;
}

// ---------------------------------------------------------------------------
// SpeechSynthesizer
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic speech synthesizer.
 *
 * Consumes IAgentResponse and produces speech output.
 * Does NOT generate responses or perform reasoning — that is
 * the responsibility of the agent and response formatter layers.
 *
 * This implementation uses the Web Speech API as a baseline.
 * For production, swap the internal `synthesize` method with
 * the actual TTS provider (Gemini, Azure, etc.).
 */
export class SpeechSynthesizer implements ISpeechOutput {
  private readonly config: Required<SpeechSynthesizerConfig>;
  private speaking = false;
  private queue: Array<{
    response: IAgentResponse;
    resolve: (token: ISpeechToken) => void;
    reject: (err: Error) => void;
  }> = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(config: SpeechSynthesizerConfig = {}) {
    this.config = {
      rate: config.rate ?? 1.0,
      volume: config.volume ?? 1.0,
      voice: config.voice ?? "",
      lang: config.lang ?? "en-US",
    };
  }

  // =========================================================================
  // ISpeechOutput implementation
  // =========================================================================

  /**
   * Synthesize and speak an agent response.
   *
   * If the synthesizer is already speaking, the response is queued.
   * Returns an ISpeechToken with timing metadata after playback.
   */
  async speak(response: IAgentResponse): Promise<ISpeechToken> {
    return new Promise<ISpeechToken>((resolve, reject) => {
      this.queue.push({ response, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Stop the current utterance immediately.
   * Does not clear the queue — queued items will play after stop.
   */
  stop(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
    this.currentUtterance = null;
    logger.debug("Speech stopped");
  }

  /**
   * Cancel all queued utterances and stop playback.
   */
  cancel(): void {
    this.stop();
    const pending = this.queue.splice(0);
    for (const item of pending) {
      item.reject(new Error("Speech cancelled"));
    }
    logger.debug("Speech cancelled", { discarded: pending.length });
  }

  /**
   * Returns true if the synthesizer is currently speaking.
   */
  isSpeaking(): boolean {
    return this.speaking;
  }

  // =========================================================================
  // Private pipeline
  // =========================================================================

  /**
   * Process the next item in the queue if not currently speaking.
   */
  private processQueue(): void {
    if (this.speaking || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.speaking = true;

    this.synthesize(item.response)
      .then((token) => {
        this.speaking = false;
        this.currentUtterance = null;
        item.resolve(token);
        this.processQueue();
      })
      .catch((err) => {
        this.speaking = false;
        this.currentUtterance = null;
        item.reject(err instanceof Error ? err : new Error(String(err)));
        this.processQueue();
      });
  }

  /**
   * Synthesize a single response into speech.
   *
   * This is the provider-agnostic abstraction point.
   * Replace this method body with the actual TTS provider call.
   */
  private async synthesize(response: IAgentResponse): Promise<ISpeechToken> {
    const text = response.content;

    if (typeof window === "undefined" || !window.speechSynthesis) {
      logger.warn("Speech synthesis unavailable (no browser API)", {
        tone: response.tone,
      });
      return { text, durationMs: 0 };
    }

    return new Promise<ISpeechToken>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.rate;
      utterance.volume = this.config.volume;
      utterance.lang = this.config.lang;

      if (this.config.voice) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.name === this.config.voice);
        if (match) utterance.voice = match;
      }

      this.currentUtterance = utterance;
      const startTime = Date.now();

      utterance.onend = () => {
        const durationMs = Date.now() - startTime;
        resolve({ text, durationMs });
      };

      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}
