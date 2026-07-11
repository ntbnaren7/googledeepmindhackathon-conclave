import { 
  AttentionBudgetConfig, 
  AttentionBudgetState, 
  IAttentionBudget, 
  ITimeProvider 
} from './interfaces';
import { RUNTIME_CONSTANTS } from '../shared/constants';

export class AttentionBudget implements IAttentionBudget {
  private remaining: number;
  private readonly max: number;
  private isInCooldown: boolean;
  private cooldownEndsAt: number | null;
  private dynamicThreshold: number;
  private totalConsumed: number;
  private totalReplenished: number;
  private interruptionCount: number;
  private lastTickTime: number;

  constructor(
    private readonly config: AttentionBudgetConfig,
    private readonly timeProvider: ITimeProvider
  ) {
    this.remaining = config.initialBudget;
    this.max = config.initialBudget;
    this.isInCooldown = false;
    this.cooldownEndsAt = null;
    this.dynamicThreshold = config.minThreshold;
    this.totalConsumed = 0;
    this.totalReplenished = 0;
    this.interruptionCount = 0;
    this.lastTickTime = this.timeProvider.now();
  }

  canInterrupt(): boolean {
    const now = this.timeProvider.now();

    if (this.isInCooldown && this.cooldownEndsAt !== null && now >= this.cooldownEndsAt) {
      this.isInCooldown = false;
      this.cooldownEndsAt = null;
    }

    if (this.isInCooldown) {
      return false;
    }

    if (this.remaining <= 0) {
      return false;
    }

    return true;
  }

  consume(cost: number): void {
    const now = this.timeProvider.now();

    if (!Number.isFinite(cost) || cost <= 0) {
      throw new Error('cost must be a finite positive number');
    }

    this.remaining = Math.max(0, this.remaining - cost);
    this.totalConsumed += cost;
    this.interruptionCount += 1;

    if (this.remaining <= 0) {
      this.isInCooldown = true;
      this.cooldownEndsAt = now + this.config.cooldownMs;
    }
  }

  tick(): void {
    const now = this.timeProvider.now();

    if (now <= this.lastTickTime) {
      return; // ignore backwards time or multiple calls in same ms
    }
    
    const elapsedMs = now - this.lastTickTime;
    this.lastTickTime = now;

    if (this.isInCooldown) {
      if (this.cooldownEndsAt !== null && now >= this.cooldownEndsAt) {
        // Cooldown just expired. We DO NOT replenish for the time spent IN cooldown.
        this.isInCooldown = false;
        const activeElapsedMs = now - this.cooldownEndsAt;
        this.cooldownEndsAt = null;
        
        // If 'now' is past 'cooldownEndsAt', only replenish for the time 
        // that elapsed AFTER the cooldown ended.
        if (activeElapsedMs > 0) {
          this.doReplenish(activeElapsedMs);
        }
      }
      return;
    }

    this.doReplenish(elapsedMs);
  }

  private doReplenish(elapsedMs: number): void {
    const unitsToAdd = (elapsedMs / 60000) * this.config.replenishRate;
    this.remaining = Math.min(this.max, this.remaining + unitsToAdd);
    this.totalReplenished += unitsToAdd;
  }

  increaseThreshold(): void {
    this.dynamicThreshold += RUNTIME_CONSTANTS.THRESHOLD_INCREASE_STEP;
  }

  decreaseThreshold(): void {
    this.dynamicThreshold = Math.max(
      this.config.minThreshold,
      this.dynamicThreshold - RUNTIME_CONSTANTS.THRESHOLD_DECREASE_STEP
    );
  }

  getState(): AttentionBudgetState {
    return Object.freeze({
      remaining: this.remaining,
      max: this.max,
      isInCooldown: this.isInCooldown,
      cooldownEndsAt: this.cooldownEndsAt,
      dynamicThreshold: this.dynamicThreshold,
      totalConsumed: this.totalConsumed,
      totalReplenished: this.totalReplenished,
      interruptionCount: this.interruptionCount,
    });
  }
}
