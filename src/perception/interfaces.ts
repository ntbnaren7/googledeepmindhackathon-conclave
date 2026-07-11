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
  /** Register the transcript callback. */
  onTranscript(handler: (raw: RawTranscript) => void): void;
  /** Whether the connector is currently connected. */
  isConnected(): boolean;
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
}
