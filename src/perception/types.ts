/**
 * Perception input types (author: Dev D).
 *
 * These model the input pipeline — microphone audio, raw provider transcripts,
 * normalized segments, speakers, and pauses. They live in the perception module
 * (not `@shared/types`) because they are Dev D's domain and are not consumed by
 * the kernel/context/agent layers. The compression OUTPUT types (`SemanticUnit`,
 * `SemanticDelta`) remain in `@shared/types` since the kernel depends on them.
 */

/** A participant in the discussion. */
export interface Speaker {
  id: string;
  label: string;
  isHuman: boolean;
}

/** A chunk of raw PCM audio captured from the microphone. */
export interface AudioChunk {
  /** Raw 16-bit PCM samples. */
  data: ArrayBuffer;
  /** Samples per second (e.g. 16000). */
  sampleRate: number;
  /** Epoch ms when the chunk was captured. */
  timestamp: number;
}

/** A raw transcript fragment as delivered by the Gemini Live connector. */
export interface RawTranscript {
  /** Recognized text for this fragment. */
  text: string;
  /** Provider speaker tag (e.g. Gemini diarization label), if present. */
  speakerTag?: string;
  /** True once the provider marks this fragment as final (not interim). */
  isFinal: boolean;
  /** Epoch ms marking the start of the spoken fragment. */
  startMs: number;
  /** Epoch ms marking the end of the spoken fragment. */
  endMs: number;
  /** Provider confidence 0..1, if available. */
  confidence?: number;
}

/** A normalized, speaker-attributed transcript segment consumed downstream. */
export interface TranscriptSegment {
  /** Unique id for this segment. */
  id: string;
  /** Resolved speaker (via diarization tracker). */
  speaker: Speaker;
  /** Segment text. */
  text: string;
  /** Epoch ms start. */
  startMs: number;
  /** Epoch ms end. */
  endMs: number;
  /** Confidence 0..1. */
  confidence: number;
}

/** Pause classifications per PRD FR-103. */
export enum PauseType {
  /** < 500ms — speaker still in flow. */
  BRIEF = 'brief',
  /** 500–2000ms — a natural conversational gap. */
  NATURAL = 'natural',
  /** > 2000ms — an extended silence. */
  EXTENDED = 'extended',
}

/** A detected conversational pause. */
export interface PauseEvent {
  type: PauseType;
  /** Pause length in ms. */
  durationMs: number;
  /** Epoch ms when the pause began. */
  startedAt: number;
}
