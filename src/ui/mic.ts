/**
 * Thin wrapper over the browser Web Speech API (SpeechRecognition). Turns spoken
 * audio into text locally — no audio streaming to the backend required — and
 * emits each finalized phrase. Feature-detects gracefully: `isSupported()` is
 * false in browsers without the API (the UI then falls back to typing).
 */

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class Mic {
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;

  constructor(
    private readonly onFinal: (text: string) => void,
    private readonly onStateChange?: (listening: boolean) => void,
  ) {}

  static isSupported(): boolean {
    return getRecognitionCtor() !== null;
  }

  isListening(): boolean {
    return this.listening;
  }

  toggle(): void {
    if (this.listening) this.stop();
    else this.start();
  }

  start(): void {
    const Ctor = getRecognitionCtor();
    if (Ctor === null || this.listening) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text !== '') this.onFinal(text);
        }
      }
    };
    recognition.onerror = () => this.stop();
    recognition.onend = () => {
      // Auto-restart while the user still wants to listen (continuous mode ends
      // itself after silence in some browsers).
      if (this.listening) recognition.start();
    };

    this.recognition = recognition;
    this.listening = true;
    this.onStateChange?.(true);
    recognition.start();
  }

  stop(): void {
    this.listening = false;
    this.onStateChange?.(false);
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
  }
}
