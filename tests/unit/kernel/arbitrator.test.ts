import { describe, it, expect, beforeEach } from 'vitest';
import { Arbitrator, NoOpMetrics } from '../../../src/kernel/arbitrator';
import { IAgentProposal } from '../../../src/shared/types';
import { ArbitrationContext, IInterventionHistory, IAgentCooldownTracker, ISemanticComparator, ITimeProvider, RecentIntervention } from '../../../src/kernel/interfaces';

class MockSemanticComparator implements ISemanticComparator {
  similarity(a: string, b: string): number {
    return a === b ? 1.0 : 0.0;
  }
}

class MockHistory implements IInterventionHistory {
  private items: RecentIntervention[] = [];
  recent() { return this.items; }
  record(p: IAgentProposal, t: number) { this.items.push({ content: p.content, agentId: p.agentId, timestamp: t }); }
  size() { return this.items.length; }
  clear() { this.items = []; }
}

class MockCooldown implements IAgentCooldownTracker {
  isOnCooldown() { return false; }
  recordIntervention() {}
}

class MockTime implements ITimeProvider {
  now() { return 1000; }
}

describe('Arbitrator', () => {
  let arbitrator: Arbitrator;
  let comparator: MockSemanticComparator;
  let history: MockHistory;
  let cooldown: MockCooldown;
  let time: MockTime;

  beforeEach(() => {
    comparator = new MockSemanticComparator();
    history = new MockHistory();
    cooldown = new MockCooldown();
    time = new MockTime();
    arbitrator = new Arbitrator(comparator, history, cooldown, time, new NoOpMetrics());
  });

  const baseContext: ArbitrationContext = {
    cycleId: 'test-cycle',
    blackboard: [],
    budgetState: {
      remaining: 100, max: 100, isInCooldown: false, cooldownEndsAt: null,
      dynamicThreshold: 0.5, totalConsumed: 0, totalReplenished: 0, interruptionCount: 0
    },
    speakerInFlow: false,
    emotionalIntensity: 0,
    recentInterruptionCount: 0,
  };

  it('handles empty proposals', () => {
    const result = arbitrator.evaluate([], baseContext);
    expect(result.granted).toBeNull();
    expect(result.rejected).toEqual([]);
    expect(result.deferred).toEqual([]);
  });

  it('defers low urgency proposals below threshold', () => {
    // Threshold is 0.5. A proposal with urgency 0.4 and cost 0.1 (min cost) has priority = 0.4 / 0.1 = 4.
    // Wait, dynamicThreshold = 0.5. priority = 4.0. That will be VALID, not deferred.
    // Base cost is 0.1. So urgency 0.04 -> priority 0.4.
    const p: IAgentProposal = { agentId: 'A', content: 'test', urgency: 0.04 };
    const result = arbitrator.evaluate([p], baseContext);
    expect(result.granted).toBeNull();
    expect(result.deferred).toEqual([p]);
  });

  it('grants a single high urgency proposal', () => {
    const p: IAgentProposal = { agentId: 'A', content: 'test', urgency: 0.9 };
    const result = arbitrator.evaluate([p], baseContext);
    expect(result.granted).toEqual(p);
  });

  it('tie-breaks exactly same priority by agentId ascending (alphabetical)', () => {
    const p1: IAgentProposal = { agentId: 'B', content: 'test1', urgency: 0.9 };
    const p2: IAgentProposal = { agentId: 'A', content: 'test2', urgency: 0.9 };
    
    const result = arbitrator.evaluate([p1, p2], baseContext);
    
    expect(result.granted).toEqual(p2); // 'A' comes before 'B'
    expect(result.rejected).toEqual([p1]);
  });

  it('deduplicates semantically identical proposals, deferring the lower priority one', () => {
    const p1: IAgentProposal = { agentId: 'A', content: 'same text', urgency: 0.9 };
    const p2: IAgentProposal = { agentId: 'B', content: 'same text', urgency: 0.8 };
    
    // B has lower priority. So A wins. B is deferred (because it was identical).
    const result = arbitrator.evaluate([p1, p2], baseContext);
    
    expect(result.granted).toEqual(p1);
    expect(result.deferred).toEqual([p2]);
    expect(result.rejected).toEqual([]);
  });
});
