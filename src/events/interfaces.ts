import { EventType } from './event-types';
import { AnyTypedEvent, PublishableEvent, TypedEvent } from './event-schema';

export interface IEventBus {
  publish<T extends EventType>(event: PublishableEvent<T>): void;
  subscribe<T extends EventType>(type: T, handler: (event: TypedEvent<T>) => void): () => void;
  subscribeAll(handler: (event: AnyTypedEvent) => void): () => void;
  getHistory(): readonly AnyTypedEvent[];
  clearHistory(): void;
}
