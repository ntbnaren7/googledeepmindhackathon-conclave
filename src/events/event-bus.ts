import { EventType } from './event-types';
import type { AnyEvent, EventPayloadMap, TypedEvent } from './event-schema';
import type {
  IEventBus,
  EventHandler,
  AnyEventHandler,
  Unsubscribe,
} from './interfaces';

/**
 * In-memory typed publish/subscribe bus.
 *
 * NOTE (Dev D self-unblock): owned by Dev A. Implemented functionally here so
 * the perception pipeline and UI can run standalone. Behavior is intentionally
 * minimal (synchronous dispatch, no ordering guarantees beyond insertion).
 */
export class EventBus implements IEventBus {
  private readonly handlers = new Map<EventType, Set<EventHandler<EventType>>>();
  private readonly globalHandlers = new Set<AnyEventHandler>();

  publish<T extends EventType>(event: {
    type: T;
    payload: EventPayloadMap[T];
    timestamp?: number;
  }): void {
    const enriched = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    } as TypedEvent<T>;

    const typed = this.handlers.get(event.type);
    if (typed) {
      for (const handler of typed) {
        try {
          (handler as EventHandler<T>)(enriched);
        } catch (err) {
          // A failing subscriber must not break dispatch to others.
          console.error(`[event-bus] handler error for ${event.type}`, err);
        }
      }
    }

    for (const handler of this.globalHandlers) {
      try {
        handler(enriched as AnyEvent);
      } catch (err) {
        console.error(`[event-bus] global handler error for ${event.type}`, err);
      }
    }
  }

  subscribe<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
  ): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<EventType>);
    return () => {
      set?.delete(handler as EventHandler<EventType>);
    };
  }

  subscribeAll(handler: AnyEventHandler): Unsubscribe {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }
}
