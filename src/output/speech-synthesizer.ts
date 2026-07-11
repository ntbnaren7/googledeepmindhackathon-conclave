import { IAgentResponse, ISpeechToken } from "@shared/types";
import { logger } from "@shared/logger";
import { ISpeechOutput, ITtsProvider, TtsSpeakOptions } from "./interfaces";
import { WebSpeechProvider } from "./web-speech-provider";

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
 * Consumes IAgentResponse and produces speech output via an injected
 * ITtsProvider. Does NOT generate responses or perform reasoning — that is
 * the responsibility of the agent and response formatter layers.
 *
 * By default, uses WebSpeechProvider (browser). For production, inject
 * any ITtsProvider (Gemini TTS, Azure, ElevenLabs, etc.).
 */
export class SpeechSynthesizer implements ISpeechOutput {
  private readonly config: Required<SpeechSynthesizerConfig>;
  private readonly provider: ITtsProvider;
  private speaking = false;
  private queue: Array<{
    response: IAgentResponse;
    resolve: (token: ISpeechToken) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(
    config: SpeechSynthesizerConfig = {},
    provider?: ITtsProvider,
  ) {
    this.config = {
      rate: config.rate ?? 1.0,
      volume: config.volume ?? 1.0,
      voice: config.voice ?? "",
      lang: config.lang ?? "en-US",
    };
    this.provider = provider ?? new WebSpeechProvider();
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
    this.provider.cancel();
    this.speaking = false;
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
        item.resolve(token);
        this.processQueue();
      })
      .catch((err) => {
        this.speaking = false;
        item.reject(err instanceof Error ? err : new Error(String(err)));
        this.processQueue();
      });
  }

  /**
   * Synthesize a single response into speech via the injected provider.
   */
  private async synthesize(response: IAgentResponse): Promise<ISpeechToken> {
    const text = response.content;
    const options: TtsSpeakOptions = {
      rate: this.config.rate,
      volume: this.config.volume,
      voice: this.config.voice || undefined,
      lang: this.config.lang,
    };

    const startTime = Date.now();
    await this.provider.speak(text, options);
    const durationMs = Date.now() - startTime;
    return { text, durationMs };
  }
}
