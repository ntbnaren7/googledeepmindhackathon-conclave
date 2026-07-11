import { EventType } from './event-types';
import type { TypedEvent, AnyEvent, EventPayloadMap } from './event-schema';

/** Handler for a single, strongly-typed event. */
export type EventHandler<T extends EventType> = (
  event: TypedEvent<T>,
) => void;

/** Handler that receives every event on the bus. */
export type AnyEventHandler = (event: AnyEvent) => void;

/** Call to remove a previously-registered handler. */
export type Unsubscribe = () => void;

export interface IEventBus {
  /** Publish a strongly-typed event. Payload shape is enforced by the type. */
  publish<T extends EventType>(
    event: { type: T; payload: EventPayloadMap[T]; timestamp?: number },
  ): void;

  /** Subscribe to a single event type. Returns an unsubscribe function. */
  subscribe<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
  ): Unsubscribe;

  /** Subscribe to all events. Returns an unsubscribe function. */
  subscribeAll(handler: AnyEventHandler): Unsubscribe;
}
