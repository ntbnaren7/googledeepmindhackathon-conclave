import type { IGeminiLiveConnector } from './interfaces';
import type { AudioChunk, RawTranscript } from './types';
import { logger } from '@shared/logger';

/** A scripted line of dialog for the mock connector to replay. */
export interface MockScriptLine {
  /** Provider-style speaker tag (drives diarization). */
  speakerTag: string;
  text: string;
  /** Delay before this line is emitted, measured from the previous line. */
  delayMs: number;
}

/**
 * The default demo dialog: a Kubernetes migration debate seeded with
 * assumptions, cost claims, and unvalidated statements that are designed to
 * trigger the CTO, Finance, and Research agents (matches PRD §23 demo flow).
 */
export const DEFAULT_MOCK_SCRIPT: MockScriptLine[] = [
  { speakerTag: 'A', text: 'I think we should migrate our whole platform to Kubernetes this quarter.', delayMs: 800 },
  { speakerTag: 'B', text: 'Agreed, it will scale better. Traffic will probably stay under ten thousand users anyway.', delayMs: 3500 },
  { speakerTag: 'A', text: 'Right, and the migration should only take a couple of weeks.', delayMs: 3500 },
  { speakerTag: 'B', text: 'Our current team can handle the Kubernetes setup, no problem.', delayMs: 3500 },
  { speakerTag: 'A', text: 'It should not really increase our infrastructure costs much.', delayMs: 3500 },
  { speakerTag: 'B', text: 'Our main competitor already moved to Kubernetes and it worked great for them.', delayMs: 3500 },
  { speakerTag: 'A', text: 'So let us commit to Kubernetes and start the migration next sprint.', delayMs: 3500 },
];

export interface MockGeminiConnectorOptions {
  script?: MockScriptLine[];
  /** Multiplier on script delays (e.g. 0.5 to replay twice as fast). */
  speed?: number;
}

/**
 * Mock connector implementing IGeminiLiveConnector by replaying a scripted
 * transcript on a timer. It is the R1/R7 contingency safety net and also powers
 * UI development without a live microphone or API key. Ignores streamed audio.
 */
export class MockGeminiConnector implements IGeminiLiveConnector {
  private readonly script: MockScriptLine[];
  private readonly speed: number;
  private connected = false;
  private index = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private transcriptHandler: ((raw: RawTranscript) => void) | null = null;
  // No-op: the mock never drops unexpectedly.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onDisconnect(_handler: () => void): void {}
  // No-op: the mock emits no audio responses.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onAudioResponse(_handler: (buffer: ArrayBuffer) => void): void {}
  // No-op: the mock logs injected text but doesn't voice it.
  sendText(text: string): void {
    // eslint-disable-next-line no-console
    console.info('[mock] sendText:', text.slice(0, 80));
  }
  // Mock is always "connected" for demo purposes.
  isConnected(): boolean { return true; }
  // No-op: mock never interrupts.
  onInterrupt(_handler: () => void): void {}

  constructor(options: MockGeminiConnectorOptions = {}) {
    this.script = options.script ?? DEFAULT_MOCK_SCRIPT;
    this.speed = options.speed ?? 1;
  }

  onTranscript(handler: (raw: RawTranscript) => void): void {
    this.transcriptHandler = handler;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.index = 0;
    logger.info('[mock-gemini] connected; replaying script', {
      lines: this.script.length,
    });
    this.scheduleNext();
  }

  // Mock ignores real audio input.
  streamAudio(_chunk: AudioChunk): void {}

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    if (!this.connected || this.index >= this.script.length) return;
    const line = this.script[this.index];
    this.timer = setTimeout(() => {
      this.emitLine(line);
      this.index += 1;
      this.scheduleNext();
    }, Math.max(0, line.delayMs * this.speed));
  }

  private emitLine(line: MockScriptLine): void {
    if (!this.transcriptHandler) return;
    const now = Date.now();
    const raw: RawTranscript = {
      text: line.text,
      speakerTag: line.speakerTag,
      isFinal: true,
      startMs: now,
      endMs: now + line.text.length * 60, // rough spoken-duration estimate
      confidence: 0.95,
    };
    this.transcriptHandler(raw);
  }
}
