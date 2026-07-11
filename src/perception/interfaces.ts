import type { SemanticDelta } from '@shared/types';
import type {
  AudioChunk,
  RawTranscript,
  TranscriptSegment,
  PauseEvent,
  Speaker,
} from './types';

/** Session parameters for a perception run. */
export interface PerceptionSessionConfig {
  meetingId: string;
  sampleRate: number;
  compressionBatchSize: number;
  compressionIntervalMs: number;
  /** When true, use the mock connector instead of real Gemini Live. */
  useMock?: boolean;
  /**
   * System instruction injected into the Live session.
   * Defaults to a generic assistant if not provided.
   * Pass the full expert-council persona here for real-time agent interruption.
   */
  systemInstruction?: string;
}

/**
 * Streaming connector to a transcription source (real Gemini Live or mock).
 * Emits RawTranscript fragments via the registered callback.
 */
export interface IGeminiLiveConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Push an audio chunk to the stream. */
  streamAudio(chunk: AudioChunk): void;
  /** Inject text as a model turn — the model speaks it back as audio. */
  sendText(text: string): void;
  /** Returns true if the session is currently connected. */
  isConnected(): boolean;
  /** Register the transcript callback. */
  onTranscript(handler: (raw: RawTranscript) => void): void;
  /** Register the audio response callback — fired when the model speaks back. */
  onAudioResponse(handler: (buffer: ArrayBuffer) => void): void;
  /** Register a callback fired when the model is interrupted mid-sentence by user speech. */
  onInterrupt(handler: () => void): void;
  /** Register a callback fired whenever the session is closed (by server or error). */
  onDisconnect(handler: () => void): void;
}

/** Converts raw transcript fragments into normalized segments. */
export interface ITranscriptProcessor {
  /** Build a TranscriptSegment from a raw fragment and its resolved speaker. */
  process(raw: RawTranscript, speaker: Speaker): TranscriptSegment;
}

/** Resolves consistent Speaker identities from provider speaker tags. */
export interface IDiarizationTracker {
  /** Return a stable Speaker for the given provider tag. */
  resolve(speakerTag: string | undefined): Speaker;
  /** All speakers seen so far. */
  getSpeakers(): Speaker[];
}

/** Detects and classifies conversational pauses. */
export interface IPauseDetector {
  /**
   * Record activity at `atMs` (e.g. new speech) and return a PauseEvent if the
   * silence since the last activity crossed a classification boundary.
   */
  observe(atMs: number): PauseEvent | null;
  /** Classify a raw silence duration without mutating state. */
  classify(durationMs: number): PauseEvent;
}

/** Compresses a batch of transcript segments into a SemanticDelta. */
export interface ISemanticCompressor {
  compress(segments: TranscriptSegment[]): Promise<SemanticDelta>;
}

/** Orchestrates the full perception pipeline. */
export interface IPerceptionEngine {
  start(config: PerceptionSessionConfig): Promise<void>;
  stop(): Promise<void>;
  pushAudio(chunk: AudioChunk): void;
}
