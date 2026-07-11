/**
 * Global type definitions for Conclave
 */

export interface Speaker {
  id: string;
  label: string;
  isHuman: boolean;
}

// =============================================================================
// PERCEPTION TYPES  (author: Dev D — self-unblock block, reconcile with Dev A)
// -----------------------------------------------------------------------------
// These types back the input pipeline: mic audio -> Gemini Live -> transcript
// segments -> semantic delta. Kept in one clearly-marked block for easy merge.
// =============================================================================

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
  /** > 5000ms — an extended silence. */
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

// =============================================================================
// SEMANTIC COMPRESSION TYPES
// -----------------------------------------------------------------------------
// Output shape of the Semantic Compressor (implemented by Dev B). Defined here
// so the Perception Engine can integrate against a stable contract.
// PRD FR-201 / FR-202.
// =============================================================================

/** Kind of extracted semantic meaning. */
export type SemanticUnitType =
  | 'proposal'
  | 'decision'
  | 'assumption'
  | 'risk'
  | 'question'
  | 'objection'
  | 'clarification'
  | 'statement'
  | 'agreement';

/** Domain a semantic unit is most relevant to. */
export type SemanticDomain =
  | 'architecture'
  | 'product'
  | 'finance'
  | 'research'
  | null;

/** A single structured unit of meaning extracted from transcript. */
export interface SemanticUnit {
  type: SemanticUnitType;
  /** One-sentence extracted meaning. */
  content: string;
  /** Confidence 0..1. */
  confidence: number;
  /** Relevant domain, or null. */
  domain: SemanticDomain;
}

/** The compressed semantic result for a batch of transcript segments. */
export interface SemanticDelta {
  /** Unique id for this delta. */
  id: string;
  /** Extracted semantic units. */
  units: SemanticUnit[];
  /** True if the topic shifted in this batch. */
  topicShift: boolean;
  /** The new topic if `topicShift` is true, else null. */
  newTopic: string | null;
  /** Source segments this delta was compressed from. */
  sourceSegments: TranscriptSegment[];
  /** Epoch ms when produced. */
  timestamp: number;
}
