import { describe, it, expect, beforeEach } from 'vitest';
import { InterventionHistory } from '../../../src/kernel/intervention-history';
import { IAgentProposal } from '../../../src/shared/types';

describe('InterventionHistory', () => {
  let history: InterventionHistory;

  beforeEach(() => {
    history = new InterventionHistory(3); // Small cap for testing
  });

  it('starts empty', () => {
    expect(history.size()).toBe(0);
    expect(history.recent()).toEqual([]);
  });

  it('records a proposal and adds timestamp', () => {
    const proposal: IAgentProposal = { agentId: 'A', content: 'hello', urgency: 0.5 };
    history.record(proposal, 100);

    const recent = history.recent();
    expect(recent.length).toBe(1);
    expect(recent[0]).toEqual({ content: 'hello', agentId: 'A', timestamp: 100 });
    expect(history.size()).toBe(1);
  });

  it('enforces maximum capacity by dropping oldest entries', () => {
    history.record({ agentId: 'A', content: '1', urgency: 0.5 }, 100);
    history.record({ agentId: 'B', content: '2', urgency: 0.5 }, 200);
    history.record({ agentId: 'C', content: '3', urgency: 0.5 }, 300);
    expect(history.size()).toBe(3);

    // This should push out '1'
    history.record({ agentId: 'D', content: '4', urgency: 0.5 }, 400);

    const recent = history.recent();
    expect(recent.length).toBe(3);
    expect(recent[0].content).toBe('2');
    expect(recent[2].content).toBe('4');
  });

  it('clears history', () => {
    history.record({ agentId: 'A', content: '1', urgency: 0.5 }, 100);
    history.clear();
    expect(history.size()).toBe(0);
    expect(history.recent()).toEqual([]);
  });
});
