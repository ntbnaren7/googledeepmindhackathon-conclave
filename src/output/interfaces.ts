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
