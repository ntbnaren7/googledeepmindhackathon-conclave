import { ITtsProvider, TtsSpeakOptions } from "./interfaces";

// ---------------------------------------------------------------------------
// WebSpeechProvider
// ---------------------------------------------------------------------------

/**
 * TTS provider backed by the browser Web Speech API (SpeechSynthesis).
 *
 * This is the ONLY file in the output module that touches
 * `window.speechSynthesis`. SpeechSynthesizer and all other output-layer
 * code depend only on the ITtsProvider interface.
 */
export class WebSpeechProvider implements ITtsProvider {
  private get synth(): SpeechSynthesis | null {
    if (typeof window === "undefined") return null;
    return window.speechSynthesis ?? null;
  }

  speak(text: string, options: TtsSpeakOptions): Promise<void> {
    const synth = this.synth;
    if (!synth) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate;
      utterance.volume = options.volume;
      utterance.lang = options.lang;

      if (options.voice) {
        const voices = synth.getVoices();
        const match = voices.find((v) => v.name === options.voice);
        if (match) utterance.voice = match;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (event) =>
        reject(new Error(`Speech synthesis error: ${event.error}`));

      synth.speak(utterance);
    });
  }

  cancel(): void {
    const synth = this.synth;
    if (synth) synth.cancel();
  }

  isSpeaking(): boolean {
    const synth = this.synth;
    return synth ? synth.speaking : false;
  }
}
