import { InterventionProposal } from '../shared/types';

// ── Time Abstraction ──

export interface ITimeProvider {
  now(): number;
}

// ── Attention Budget ──

export interface AttentionBudgetConfig {
  readonly initialBudget: number;
  readonly replenishRate: number;        // units per minute
  readonly interruptionBaseCost: number;
  readonly cooldownMs: number;
  readonly minThreshold: number;         // floor for dynamic urgency threshold
}

export interface AttentionBudgetState {
  readonly remaining: number;
  readonly max: number;
  readonly isInCooldown: boolean;
  readonly cooldownEndsAt: number | null;  // epoch ms, null if not in cooldown
  readonly dynamicThreshold: number;       // current urgency threshold
  readonly totalConsumed: number;
  readonly totalReplenished: number;
  readonly interruptionCount: number;
}

export interface IAttentionBudget {
  canInterrupt(): boolean;
  consume(cost: number): void;
  tick(): void;
  increaseThreshold(): void;
  decreaseThreshold(): void;
  getState(): AttentionBudgetState;
}

// ── Attention Gate ──

export interface SpeakingToken {
  readonly tokenId: string;
  readonly agentId: string;
  readonly proposalId: string;
  readonly grantedAt: number;
  readonly expiresAt: number;
}

export interface IAttentionGate {
  tryGrant(proposal: InterventionProposal): SpeakingToken | null;
  revoke(tokenId: string): void;
  isAgentSpeaking(): boolean;
  getActiveToken(): SpeakingToken | null;
  onSpeechComplete(tokenId: string): void;
}

export interface ICognitiveKernel {
  start(config: any): Promise<void>;
  stop(): Promise<void>;
}
