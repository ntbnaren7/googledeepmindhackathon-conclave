import { EventType } from './event-types';
import type {
  Speaker,
  TranscriptSegment,
  PauseEvent,
  SemanticDelta,
} from '@shared/types';

/**
 * Event payload contract.
 *
 * NOTE (Dev D self-unblock): this file is owned by Dev A. Only the
 * perception-relevant payloads are fully specified below; the remaining
 * event types are typed as `unknown` placeholders so the map stays total
 * and compiles today. Dev A refines the kernel/context payloads later.
 * Additions here are additive — existing entries must not be re-shaped.
 */
export interface EventPayloadMap {
  // ---- Perception (Dev D) ----
  [EventType.SPEAKER_STARTED]: { speaker: Speaker; at: number };
  [EventType.SPEAKER_STOPPED]: { speaker: Speaker; at: number };
  [EventType.TRANSCRIPT_UPDATE]: { segment: TranscriptSegment };
  [EventType.PAUSE_DETECTED]: { pause: PauseEvent };
  [EventType.DELTA_PRODUCED]: { delta: SemanticDelta };

  // ---- Kernel / Context / Output (Dev A, B, C) — placeholders ----
  [EventType.TICK_STARTED]: unknown;
  [EventType.TICK_COMPLETED]: unknown;
  [EventType.INTERRUPT_GRANTED]: unknown;
  [EventType.AGENT_SPEAKING]: unknown;
  [EventType.BLACKBOARD_UPDATED]: unknown;
  [EventType.CONTEXT_UPDATED]: unknown;
  [EventType.MEETING_STARTED]: unknown;
}

/** Base fields present on every event. */
export interface BaseEvent {
  /** Epoch ms the event was published (filled by the bus if absent). */
  timestamp?: number;
}

/** A strongly-typed event: the payload is inferred from the event type. */
export type TypedEvent<T extends EventType> = BaseEvent & {
  type: T;
  payload: EventPayloadMap[T];
};

/** The union of every possible typed event. */
export type AnyEvent = {
  [T in EventType]: TypedEvent<T>;
}[EventType];

/** Union of the semantic-pipeline events the perception layer emits. */
export type AnySemanticEvent =
  | TypedEvent<EventType.SPEAKER_STARTED>
  | TypedEvent<EventType.SPEAKER_STOPPED>
  | TypedEvent<EventType.TRANSCRIPT_UPDATE>
  | TypedEvent<EventType.PAUSE_DETECTED>
  | TypedEvent<EventType.DELTA_PRODUCED>;
