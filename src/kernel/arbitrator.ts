import { IAgentProposal, ArbitrationResult } from '../shared/types';
import { RUNTIME_CONSTANTS } from '../shared/constants';
import {
  IArbitrator,
  ArbitrationContext,
  ISemanticComparator,
  IInterventionHistory,
  IAgentCooldownTracker,
  IKernelMetrics,
  ITimeProvider,
} from './interfaces';

export class NoOpMetrics implements IKernelMetrics {
  recordArbitration(): void {}
}

interface ScoredProposal {
  readonly proposal: IAgentProposal;
  readonly priority: number;
}

interface FilterResult {
  readonly valid: readonly ScoredProposal[];
  readonly rejected: readonly IAgentProposal[];
  readonly deferred: readonly IAgentProposal[];
}

export class Arbitrator implements IArbitrator {
  constructor(
    private readonly semanticComparator: ISemanticComparator,
    private readonly history: IInterventionHistory,
    private readonly cooldownTracker: IAgentCooldownTracker,
    private readonly timeProvider: ITimeProvider,
    private readonly metrics: IKernelMetrics = new NoOpMetrics()
  ) {}

  evaluate(proposals: readonly IAgentProposal[], context: ArbitrationContext): ArbitrationResult {
    const startMs = this.timeProvider.now();

    if (proposals.length === 0) {
      this.metrics.recordArbitration({
        cycleId: context.cycleId,
        proposalCount: 0,
        validCount: 0,
        deferredCount: 0,
        winnerPriority: 0,
        evaluationTimeMs: this.timeProvider.now() - startMs,
      });
      return { granted: null, rejected: [], deferred: [] };
    }

    // 1. & 2. Scoring & Convergence
    const scoredProposals = proposals.map((p) => {
      const priority = this.calculatePriority(p, context);
      return { proposal: p, priority };
    });

    // 3. Filtering
    const filterResult = this.filterProposals(scoredProposals, context, startMs);

    // 4. Deduplication
    const { uniqueValid, additionalDeferred } = this.deduplicate(filterResult.valid);

    // 5. Selection
    const allDeferred = [...filterResult.deferred, ...additionalDeferred];
    const winner = this.selectWinner(uniqueValid, filterResult.rejected, allDeferred, startMs);

    // 6. Metrics
    const winnerPriority =
      winner.granted !== null
        ? uniqueValid.find((u) => u.proposal === winner.granted)?.priority ?? 0
        : 0;

    this.metrics.recordArbitration({
      cycleId: context.cycleId,
      proposalCount: proposals.length,
      validCount: uniqueValid.length,
      deferredCount: allDeferred.length,
      winnerPriority,
      evaluationTimeMs: this.timeProvider.now() - startMs,
    });

    return winner;
  }

  private calculatePriority(proposal: IAgentProposal, context: ArbitrationContext): number {
    // Interruption Cost
    const inFlowCost = context.speakerInFlow ? RUNTIME_CONSTANTS.SPEAKER_IN_FLOW_COST : 0;
    const recentCost = context.recentInterruptionCount * RUNTIME_CONSTANTS.RECENT_INTERRUPTION_COST;
    const emotionalCost = context.emotionalIntensity * RUNTIME_CONSTANTS.EMOTIONAL_INTENSITY_COST;
    const cost = Math.max(
      RUNTIME_CONSTANTS.MIN_INTERRUPT_COST,
      inFlowCost + recentCost + emotionalCost
    );

    // Novelty
    const recentHistory = this.history.recent();
    let maxSimilarityToHistory = 0;
    for (const h of recentHistory) {
      const sim = this.semanticComparator.similarity(proposal.content, h.content);
      if (sim > maxSimilarityToHistory) {
        maxSimilarityToHistory = sim;
      }
    }
    const novelty = 1.0 - maxSimilarityToHistory;

    // Base Priority
    const basePriority = (proposal.urgency * novelty) / cost;

    // Convergence Bonus
    let convergenceMatchCount = 0;
    for (const entry of context.blackboard) {
      // Don't converge with own posts
      if (entry.agentId === proposal.agentId) continue;

      const sim = this.semanticComparator.similarity(proposal.content, entry.content);
      if (sim > RUNTIME_CONSTANTS.SIMILARITY_NOVELTY_THRESHOLD) {
        convergenceMatchCount++;
      }
    }
    const convergenceBonus = Math.min(
      RUNTIME_CONSTANTS.MAX_CONVERGENCE_BONUS,
      convergenceMatchCount * RUNTIME_CONSTANTS.CONVERGENCE_BONUS_MULTIPLIER
    );

    return basePriority + convergenceBonus;
  }

  private filterProposals(
    scored: readonly ScoredProposal[],
    context: ArbitrationContext,
    now: number
  ): FilterResult {
    const valid: ScoredProposal[] = [];
    const rejected: IAgentProposal[] = [];
    const deferred: IAgentProposal[] = [];

    const threshold =
      context.budgetState.dynamicThreshold *
      (context.speakerInFlow ? RUNTIME_CONSTANTS.IN_FLOW_THRESHOLD_MULTIPLIER : 1);

    for (const sp of scored) {
      if (this.cooldownTracker.isOnCooldown(sp.proposal.agentId, now)) {
        rejected.push(sp.proposal);
      } else if (sp.priority < threshold) {
        deferred.push(sp.proposal);
      } else {
        valid.push(sp);
      }
    }

    return { valid, rejected, deferred };
  }

  private deduplicate(valid: readonly ScoredProposal[]): {
    uniqueValid: readonly ScoredProposal[];
    additionalDeferred: readonly IAgentProposal[];
  } {
    if (valid.length <= 1) {
      return { uniqueValid: valid, additionalDeferred: [] };
    }

    // Sort by priority descending first
    const sorted = [...valid].sort((a, b) => b.priority - a.priority);
    const uniqueValid: ScoredProposal[] = [];
    const additionalDeferred: IAgentProposal[] = [];

    for (const sp of sorted) {
      let isDuplicate = false;
      for (const accepted of uniqueValid) {
        const sim = this.semanticComparator.similarity(sp.proposal.content, accepted.proposal.content);
        if (sim > RUNTIME_CONSTANTS.SIMILARITY_NOVELTY_THRESHOLD) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        additionalDeferred.push(sp.proposal);
      } else {
        uniqueValid.push(sp);
      }
    }

    return { uniqueValid, additionalDeferred };
  }

  private selectWinner(
    uniqueValid: readonly ScoredProposal[],
    rejected: readonly IAgentProposal[],
    deferred: readonly IAgentProposal[],
    now: number
  ): ArbitrationResult {
    if (uniqueValid.length === 0) {
      return { granted: null, rejected, deferred };
    }

    // Sort to find the winner: Priority (desc) -> agentId (asc)
    const sorted = [...uniqueValid].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Deterministic tie-breaker
      if (a.proposal.agentId < b.proposal.agentId) return -1;
      if (a.proposal.agentId > b.proposal.agentId) return 1;
      return 0;
    });

    const winner = sorted[0].proposal;

    // Everything else is rejected since they lost the tie
    const allRejected = [...rejected, ...sorted.slice(1).map((sp) => sp.proposal)];

    // Record winner
    this.history.record(winner, now);
    this.cooldownTracker.recordIntervention(winner.agentId, now);

    return {
      granted: winner,
      rejected: allRejected,
      deferred,
    };
  }
}
