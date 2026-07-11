import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttentionBudget } from '../../../src/kernel/attention-budget';
import { AttentionBudgetConfig, ITimeProvider } from '../../../src/kernel/interfaces';
import { RUNTIME_CONSTANTS } from '../../../src/shared/constants';

describe('AttentionBudget', () => {
  let budget: AttentionBudget;
  let timeProvider: ITimeProvider;
  let currentTime: number;

  const config: AttentionBudgetConfig = {
    initialBudget: 100,
    replenishRate: 5,
    interruptionBaseCost: 10,
    cooldownMs: 30000,
    minThreshold: 0.3,
  };

  beforeEach(() => {
    currentTime = 1000000;
    timeProvider = {
      now: () => currentTime,
    };
    budget = new AttentionBudget(config, timeProvider);
  });

  describe('Initialization', () => {
    it('initializes with correct default state (FR-801)', () => {
      const state = budget.getState();
      expect(state.remaining).toBe(100);
      expect(state.max).toBe(100);
      expect(state.isInCooldown).toBe(false);
      expect(state.cooldownEndsAt).toBeNull();
      expect(state.dynamicThreshold).toBe(0.3);
      expect(state.totalConsumed).toBe(0);
      expect(state.totalReplenished).toBe(0);
      expect(state.interruptionCount).toBe(0);
    });
  });

  describe('canInterrupt & consume', () => {
    it('canInterrupt returns true when budget is available', () => {
      expect(budget.canInterrupt()).toBe(true);
    });

    it('consume decreases remaining correctly (FR-802)', () => {
      budget.consume(20);
      const state = budget.getState();
      expect(state.remaining).toBe(80);
      expect(state.totalConsumed).toBe(20);
      expect(state.interruptionCount).toBe(1);
    });

    it('consume throws if cost <= 0 or cost is NaN/Infinity', () => {
      expect(() => budget.consume(0)).toThrow('cost must be a finite positive number');
      expect(() => budget.consume(-10)).toThrow('cost must be a finite positive number');
      expect(() => budget.consume(NaN)).toThrow('cost must be a finite positive number');
      expect(() => budget.consume(Infinity)).toThrow('cost must be a finite positive number');
    });

    it('consume triggers cooldown when remaining hits 0 (FR-804)', () => {
      budget.consume(100);
      const state = budget.getState();
      expect(state.remaining).toBe(0);
      expect(state.isInCooldown).toBe(true);
      expect(state.cooldownEndsAt).toBe(currentTime + config.cooldownMs);
    });

    it('canInterrupt returns false during cooldown (FR-804)', () => {
      budget.consume(100); // Trigger cooldown
      expect(budget.canInterrupt()).toBe(false);
    });

    it('canInterrupt exits cooldown exactly when now === cooldownEndsAt', () => {
      budget.consume(100);
      currentTime += config.cooldownMs;
      
      // Still false because remaining is 0, but it should exit cooldown
      expect(budget.canInterrupt()).toBe(false); 
      
      const state = budget.getState();
      expect(state.isInCooldown).toBe(false);
      expect(state.cooldownEndsAt).toBeNull();
      
      // Now replenish so we can interrupt again
      currentTime += 60000;
      budget.tick();
      expect(budget.canInterrupt()).toBe(true);
    });

    it('canInterrupt exits cooldown after cooldownMs elapses', () => {
      budget.consume(100);
      currentTime += config.cooldownMs + 1000;
      
      expect(budget.canInterrupt()).toBe(false); // Exited cooldown, but remaining is 0
      
      currentTime += 60000;
      budget.tick();
      expect(budget.canInterrupt()).toBe(true);
    });
  });

  describe('tick (Replenishment)', () => {
    it('tick ignores backwards clock', () => {
      currentTime -= 1000;
      budget.tick();
      const state = budget.getState();
      expect(state.remaining).toBe(100);
      expect(state.totalReplenished).toBe(0);
    });

    it('tick accumulates correctly over multiple calls without double counting', () => {
      budget.consume(50);
      
      currentTime += 60000; // 1 min passed
      budget.tick(); // Replenish 5
      expect(budget.getState().remaining).toBe(55);

      budget.tick(); // No time passed
      expect(budget.getState().remaining).toBe(55);
    });

    it('tick adds units proportional to elapsed time since last tick (FR-803)', () => {
      budget.consume(50);
      
      currentTime += 30000; // half a minute
      budget.tick(); // Replenish 2.5
      expect(budget.getState().remaining).toBe(52.5);
    });

    it('tick never exceeds max', () => {
      budget.consume(2);
      currentTime += 60000;
      budget.tick(); // Wants to replenish 5, but only 2 missing
      expect(budget.getState().remaining).toBe(100);
    });

    it('tick does nothing during active cooldown (FR-804)', () => {
      budget.consume(100); // Enters cooldown
      currentTime += 10000;
      budget.tick();
      expect(budget.getState().remaining).toBe(0);
    });

    it('tick exits cooldown and only replenishes time AFTER cooldown', () => {
      budget.consume(100); // Enters cooldown for 30s
      currentTime += 40000; // 40s passed (10s after cooldown)
      budget.tick();
      
      const state = budget.getState();
      expect(state.isInCooldown).toBe(false);
      
      // Should replenish 10s worth: (10 / 60) * 5 = (1/6) * 5 = 5/6 = 0.8333...
      expect(state.remaining).toBeCloseTo(0.8333, 3);
    });
  });

  describe('Dynamic Threshold', () => {
    it('increaseThreshold raises by THRESHOLD_INCREASE_STEP (FR-805)', () => {
      budget.increaseThreshold();
      expect(budget.getState().dynamicThreshold).toBeCloseTo(0.3 + RUNTIME_CONSTANTS.THRESHOLD_INCREASE_STEP, 5);
    });

    it('decreaseThreshold lowers by THRESHOLD_DECREASE_STEP but not below floor (FR-806)', () => {
      budget.increaseThreshold(); // Goes to 0.35 (assuming step is 0.05)
      budget.decreaseThreshold();
      expect(budget.getState().dynamicThreshold).toBeCloseTo(0.3 + RUNTIME_CONSTANTS.THRESHOLD_INCREASE_STEP - RUNTIME_CONSTANTS.THRESHOLD_DECREASE_STEP, 5);
      
      budget.decreaseThreshold();
      budget.decreaseThreshold();
      expect(budget.getState().dynamicThreshold).toBe(0.3); // Floor
    });
  });

  describe('Immutability', () => {
    it('getState returns a frozen snapshot', () => {
      const state = budget.getState();
      expect(Object.isFrozen(state)).toBe(true);
    });
  });
});
