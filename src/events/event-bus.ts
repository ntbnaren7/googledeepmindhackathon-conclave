import { EventType } from './event-types';
import { AnyTypedEvent, PublishableEvent, TypedEvent } from './event-schema';
import { generateId } from '../shared/id-generator';
import { logger } from '../shared/logger';
import { IEventBus } from './interfaces';

type EventHandler<T extends EventType> = (event: TypedEvent<T>) => void;
type AnyEventHandler = (event: AnyTypedEvent) => void;

export class EventBus implements IEventBus {
  private readonly history: AnyTypedEvent[] = [];
  
  // O(1) duplicate prevention and unsubscribe
  private readonly subscribers = new Map<EventType, Set<AnyEventHandler>>();
  private readonly globalSubscribers = new Set<AnyEventHandler>();

  publish<T extends EventType>(event: PublishableEvent<T>): void {
    // 1. Assign ID and Timestamp
    const typedEvent = Object.freeze({
      id: generateId(),
      timestamp: Date.now(),
      ...event,
    }) as AnyTypedEvent;
    
    // 2. Push frozen event into history
    this.history.push(typedEvent);
    
    // 3. Dispatch to all specific subscribers
    const handlers = this.subscribers.get(event.type as EventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(typedEvent);
        } catch (error) {
          logger.error(`Error in event handler for ${event.type}`, { error, eventId: typedEvent.id });
        }
      }
    }

    // 4. Dispatch to global subscribers
    for (const handler of this.globalSubscribers) {
      try {
        handler(typedEvent);
      } catch (error) {
        logger.error(`Error in global event handler`, { error, eventId: typedEvent.id });
      }
    }
  }

  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    
    const handlers = this.subscribers.get(type)!;
    // We safely cast the generic handler to the generic internal type
    const anyHandler = handler as unknown as AnyEventHandler;
    handlers.add(anyHandler);
    
    return () => {
      const currentHandlers = this.subscribers.get(type);
      if (currentHandlers) {
        currentHandlers.delete(anyHandler);
      }
    };
  }
  
  subscribeAll(handler: (event: AnyTypedEvent) => void): () => void {
    this.globalSubscribers.add(handler);
    
    return () => {
      this.globalSubscribers.delete(handler);
    };
  }

  getHistory(): readonly AnyTypedEvent[] {
    // Freeze the outer array to prevent accidental reference mutation
    return Object.freeze([...this.history]);
  }
  
  clearHistory(): void {
    this.history.length = 0;
  }
}
