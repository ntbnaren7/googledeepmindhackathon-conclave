import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../../src/events/event-bus';
import { EventType } from '../../../src/events/event-types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should publish to specific subscribers', () => {
    const handler = vi.fn();
    eventBus.subscribe(EventType.SPEAKER_STARTED, handler);

    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe(EventType.SPEAKER_STARTED);
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('should publish to global subscribers', () => {
    const globalHandler = vi.fn();
    eventBus.subscribeAll(globalHandler);

    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });

    eventBus.publish({
      type: EventType.SPEAKER_STOPPED,
      source: 'test',
      payload: {},
    });

    expect(globalHandler).toHaveBeenCalledTimes(2);
  });

  it('should isolate handler errors via try/catch', () => {
    const errorThrowingHandler = vi.fn(() => {
      throw new Error('Boom!');
    });
    const safeHandler = vi.fn();

    eventBus.subscribe(EventType.SPEAKER_STARTED, errorThrowingHandler);
    eventBus.subscribe(EventType.SPEAKER_STARTED, safeHandler);

    // Publishing should not throw
    expect(() => {
      eventBus.publish({
        type: EventType.SPEAKER_STARTED,
        source: 'test',
        payload: {},
      });
    }).not.toThrow();

    expect(errorThrowingHandler).toHaveBeenCalledTimes(1);
    expect(safeHandler).toHaveBeenCalledTimes(1); // Second handler still executes
  });

  it('should allow unsubscription via O(1) set delete', () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe(EventType.SPEAKER_STARTED, handler);

    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });
    expect(handler).toHaveBeenCalledTimes(1); // Should not increase
  });

  it('should strictly preserve history and freeze published events', () => {
    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });

    const history = eventBus.getHistory();
    expect(history.length).toBe(1);

    const event = history[0];
    expect(Object.isFrozen(event)).toBe(true);

    expect(Object.isFrozen(history)).toBe(true);
  });

  it('should clear history successfully', () => {
    eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      source: 'test',
      payload: {},
    });
    
    expect(eventBus.getHistory().length).toBe(1);
    eventBus.clearHistory();
    expect(eventBus.getHistory().length).toBe(0);
  });
});