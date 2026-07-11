import { IAgentResponse, ISpeechToken } from "@shared/types";

/**
 * Provider-agnostic speech output interface.
 *
 * Implementations wrap a TTS backend (Gemini, Azure, browser, etc.)
 * but this interface remains backend-agnostic.
 */
export interface ISpeechOutput {
  /**
   * Synthesize and speak an agent response.
   * Returns a speech token with timing metadata.
   */
  speak(response: IAgentResponse): Promise<ISpeechToken>;

  /** Stop the current utterance immediately. */
  stop(): void;

  /** Cancel all queued utterances and stop playback. */
  cancel(): void;

  /** Returns true if the synthesizer is currently speaking. */
  isSpeaking(): boolean;
}

/**
 * Low-level TTS provider interface.
 *
 * Abstracts the platform-specific speech synthesis API (Web Speech, Gemini,
 * Azure, etc.) so that SpeechSynthesizer remains provider-agnostic.
 *
 * Each provider owns the actual platform call; SpeechSynthesizer only
 * orchestrates queueing and state management.
 */
export interface ITtsProvider {
  /**
   * Speak the given text and resolve when playback finishes.
   * Rejects on error.
   */
  speak(text: string, options: TtsSpeakOptions): Promise<void>;

  /** Cancel any in-progress utterance. */
  cancel(): void;

  /** Whether the provider is currently speaking. */
  isSpeaking(): boolean;
}

/** Options passed to ITtsProvider.speak(). */
export interface TtsSpeakOptions {
  /** Speech rate (0.5 = slow, 1.0 = normal, 2.0 = fast). */
  rate: number;
  /** Volume (0.0 = silent, 1.0 = normal). */
  volume: number;
  /** Voice name or ID (provider-specific). */
  voice?: string;
  /** Language code (e.g., "en-US"). */
  lang: string;
}
