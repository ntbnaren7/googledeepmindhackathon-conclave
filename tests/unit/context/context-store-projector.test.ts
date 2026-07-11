import { describe, expect, it } from 'vitest';
import { ContextProjector } from '../../../src/context/context-projector';
import {
  ContextStore,
  createEmptyContextState,
} from '../../../src/context/context-store';

describe('ContextStore', () => {
  it('starts with an empty context state', () => {
    expect(createEmptyContextState()).toEqual({
      currentTopic: null,
      topicHistory: [],
      decisions: [],
      assumptions: [],
      risks: [],
      interventions: [],
    });
  });

  it('updates and resets the mutable working state', () => {
    const store = new ContextStore();

    store.update((state) => {
      state.decisions.push({
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'proposed',
        supporting: [],
        opposing: [],
        timestamp: 1000,
      });
    });

    expect(store.getState().decisions).toHaveLength(1);

    store.reset();

    expect(store.getState()).toEqual(createEmptyContextState());
  });
});

describe('ContextProjector', () => {
  it('projects an immutable snapshot without exposing store references', () => {
    const state = createEmptyContextState();
    state.currentTopic = {
      id: 'topic-1',
      title: 'Backend architecture',
      startedAtTimestamp: 1000,
    };
    state.decisions.push({
      id: 'decision-1',
      statement: 'Use managed Postgres',
      status: 'proposed',
      supporting: [],
      opposing: [],
      timestamp: 1001,
    });

    const snapshot = new ContextProjector().project(state);

    expect(snapshot.id).toBeTruthy();
    expect(typeof snapshot.timestamp).toBe('number');
    expect(snapshot.currentTopic).toEqual(state.currentTopic);
    expect(snapshot.decisions).toEqual(state.decisions);
    expect(snapshot.decisions).not.toBe(state.decisions);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.decisions)).toBe(true);
    expect(Object.isFrozen(snapshot.decisions[0])).toBe(true);

    state.decisions[0].statement = 'Use Cloud SQL';

    expect(snapshot.decisions[0].statement).toBe('Use managed Postgres');
  });
});
