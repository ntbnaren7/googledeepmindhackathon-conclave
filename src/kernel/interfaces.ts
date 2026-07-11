import { IAgentProposal, IBlackboardEntry, IBlackboardState, ArbitrationResult } from '../shared/types';
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
  readonly grantedAt: number;
  readonly expiresAt: number;
}

export interface IAttentionGate {
  tryGrant(proposal: IAgentProposal): SpeakingToken | null;
  revoke(tokenId: string): void;
  isAgentSpeaking(): boolean;
  getActiveToken(): SpeakingToken | null;
  onSpeechComplete(tokenId: string): void;
}

export interface ICognitiveKernel {
  start(config: any): Promise<void>;
  stop(): Promise<void>;
}

// ── Semantic Comparison ──

export interface ISemanticComparator {
  /** 
   * MUST be symmetric: similarity(a, b) === similarity(b, a).
   * Asymmetric rerankers cannot be used here directly.
   */
  similarity(textA: string, textB: string): number;
}

// ── Blackboard ──

export interface IBlackboard {
  /** Adds entries for the CURRENT cycle. Rejects exact duplicate entries. Not visible in getState() until rotate(). */
  post(entries: readonly IBlackboardEntry[]): void;
  
  /** Rotates pending entries into the active visible pool, frozen (FR-902). */
  rotate(): void;
  
  /** Retrieves all visible entries from the PREVIOUS cycle. */
  getState(): IBlackboardState;
}

// ── Intervention History ──

export interface RecentIntervention {
  readonly content: string;
  readonly agentId: string;
  readonly timestamp: number;
}

export interface IInterventionHistory {
  recent(): readonly RecentIntervention[];
  record(proposal: IAgentProposal, timestamp: number): void;
  size(): number;
  clear(): void;
}

// ── Metrics ──

export interface ArbitrationMetrics {
  readonly cycleId: string;
  readonly proposalCount: number;
  readonly validCount: number;
  readonly deferredCount: number;
  readonly winnerPriority: number;
  readonly evaluationTimeMs: number;
}

export interface IKernelMetrics {
  recordArbitration(metrics: ArbitrationMetrics): void;
}

// ── Arbitrator ──

export interface ArbitrationContext {
  readonly cycleId: string;
  readonly blackboard: IBlackboardState;
  readonly budgetState: AttentionBudgetState;
  readonly speakerInFlow: boolean;
  readonly emotionalIntensity: number; 
  readonly recentInterruptionCount: number;
}

export interface IAgentCooldownTracker {
  isOnCooldown(agentId: string, now: number): boolean;
  recordIntervention(agentId: string, now: number): void;
}

export interface IArbitrator {
  evaluate(proposals: readonly IAgentProposal[], context: ArbitrationContext): ArbitrationResult;
}
