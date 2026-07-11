import { EventType } from './event-types';
import { SemanticDelta } from '../shared/types';

export interface BaseEvent {
  readonly id: string;
  readonly type: EventType;
  readonly timestamp: number;
  readonly source: string;
  readonly correlationId?: string;
}

export interface EventPayloadMap {
  [EventType.SPEAKER_STARTED]: Record<string, never>;
  [EventType.SPEAKER_STOPPED]: Record<string, never>;
  [EventType.TRANSCRIPT_UPDATE]: Record<string, never>;
  [EventType.PAUSE_DETECTED]: Record<string, never>;
  [EventType.DELTA_PRODUCED]: { readonly delta: SemanticDelta };
  [EventType.CYCLE_STARTED]: Record<string, never>;
  [EventType.CYCLE_COMPLETED]: Record<string, never>; // To be updated by Kernel
  [EventType.INTERRUPT_GRANTED]: Record<string, never>;
  [EventType.AGENT_SPEAKING]: Record<string, never>;
  [EventType.AGENT_FINISHED]: Record<string, never>;
  [EventType.BLACKBOARD_UPDATED]: Record<string, never>;
  [EventType.CONTEXT_UPDATED]: Record<string, never>;
  [EventType.MEETING_STARTED]: Record<string, never>;
  [EventType.TOPIC_CHANGED]: Record<string, never>;
}

export interface TypedEvent<T extends EventType> extends BaseEvent {
  readonly type: T;
  readonly payload: EventPayloadMap[T];
}

// Strictly binds any typed event, avoiding `any`
export type AnyTypedEvent = {
  [K in EventType]: TypedEvent<K>;
}[EventType];

export type PublishableEvent<T extends EventType> = Omit<TypedEvent<T>, 'id' | 'timestamp'>;
