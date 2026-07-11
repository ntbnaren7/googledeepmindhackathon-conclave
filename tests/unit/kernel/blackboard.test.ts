import { describe, it, expect, beforeEach } from 'vitest';
import { CognitiveBlackboard } from '../../../src/kernel/blackboard';
import { IBlackboardEntry } from '../../../src/shared/types';

describe('CognitiveBlackboard', () => {
  let blackboard: CognitiveBlackboard;

  beforeEach(() => {
    blackboard = new CognitiveBlackboard();
  });

  it('starts with an empty state', () => {
    expect(blackboard.getState()).toEqual([]);
  });

  it('does not expose pending entries until rotated', () => {
    blackboard.post([
      { agentId: 'A', content: 'test', timestamp: 100 }
    ]);
    expect(blackboard.getState()).toEqual([]);
  });

  it('exposes entries after rotation', () => {
    const entries: IBlackboardEntry[] = [
      { agentId: 'A', content: 'test', timestamp: 100 }
    ];
    blackboard.post(entries);
    blackboard.rotate();
    expect(blackboard.getState()).toEqual(entries);
  });

  it('deduplicates exact agentId+content matches in the pending cycle', () => {
    blackboard.post([
      { agentId: 'A', content: 'hello', timestamp: 100 },
      { agentId: 'A', content: 'hello', timestamp: 101 }, // Duplicate
      { agentId: 'B', content: 'hello', timestamp: 102 }  // Different agent
    ]);
    blackboard.rotate();

    const state = blackboard.getState();
    expect(state.length).toBe(2);
    expect(state[0].agentId).toBe('A');
    expect(state[1].agentId).toBe('B');
  });

  it('clears previous active entries on rotation', () => {
    blackboard.post([{ agentId: 'A', content: 'cycle1', timestamp: 100 }]);
    blackboard.rotate();
    
    blackboard.post([{ agentId: 'B', content: 'cycle2', timestamp: 200 }]);
    blackboard.rotate();

    const state = blackboard.getState();
    expect(state.length).toBe(1);
    expect(state[0].content).toBe('cycle2');
  });
});
