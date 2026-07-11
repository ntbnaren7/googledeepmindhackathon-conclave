import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCooldownTracker } from '../../../src/kernel/cooldown-tracker';

describe('AgentCooldownTracker', () => {
  let tracker: AgentCooldownTracker;

  beforeEach(() => {
    tracker = new AgentCooldownTracker(1000); // 1s cooldown
  });

  it('initially reports no cooldown', () => {
    expect(tracker.isOnCooldown('A', 500)).toBe(false);
  });

  it('records intervention and enforces cooldown', () => {
    tracker.recordIntervention('A', 100);
    expect(tracker.isOnCooldown('A', 500)).toBe(true); // 400ms passed, still on cooldown
  });

  it('lifts cooldown after threshold is met', () => {
    tracker.recordIntervention('A', 100);
    expect(tracker.isOnCooldown('A', 1100)).toBe(false); // exactly 1000ms passed, technically < 1000 is false, so 1100 - 100 = 1000 => false.
  });

  it('tracks agents independently', () => {
    tracker.recordIntervention('A', 100);
    expect(tracker.isOnCooldown('A', 500)).toBe(true);
    expect(tracker.isOnCooldown('B', 500)).toBe(false);
  });
});
