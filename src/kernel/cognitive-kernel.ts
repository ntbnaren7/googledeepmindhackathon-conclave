import { ICognitiveKernel, IArbitrator, IBlackboard, IAttentionGate, IAttentionBudget, ITimeProvider, ArbitrationContext, ICognitiveScheduler, EvaluationContext } from './interfaces';
import { IAgentProposal, IBlackboardEntry, ArbitrationResult, ContextSnapshot, SemanticDelta, IAgentResult } from '../shared/types';
import { IEventBus } from '../events/interfaces';
import { EventType } from '../events/event-types';
import { adaptContextSnapshot } from './context-adapter';
import { randomUUID } from 'crypto';
import { logger } from '../shared/logger';
import { IContextEngine } from '../context/interfaces';

export interface KernelDependencies {
  readonly arbitrator: IArbitrator;
  readonly blackboard: IBlackboard;
  readonly attentionGate: IAttentionGate;
  readonly attentionBudget: IAttentionBudget;
  readonly timeProvider: ITimeProvider;
  readonly scheduler: ICognitiveScheduler;
  readonly eventBus: IEventBus;
  readonly contextEngine: IContextEngine;
  /** Agent evaluation timeout in ms. Defaults to 15000 if not set. */
  readonly agentTimeoutMs?: number;
  /**
   * Minimum milliseconds between evaluation cycles.
   * Prevents the kernel from triggering on every small context update.
   * Default: 8000 (8 seconds).
   */
  readonly evaluationDebounceMs?: number;
  /**
   * Milliseconds to stay quiet after an agent speaks.
   * Prevents agents from responding to their own injected text.
   * Default: 15000 (15 seconds).
   */
  readonly postSpeechQuietMs?: number;
}

export class CognitiveKernel implements ICognitiveKernel {
  private isRunning = false;
  private isEvaluating = false;
  private contextVersion = 0;

  /** Timestamp of the last completed evaluation cycle. */
  private lastEvaluationAt = 0;
  /** Timestamp until which the kernel will not evaluate (post-speech quiet). */
  private quietUntil = 0;

  constructor(private readonly deps: KernelDependencies) {}

  async start(config?: any): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const debounceMs = this.deps.evaluationDebounceMs ?? 8000;
    const quietMs    = this.deps.postSpeechQuietMs    ?? 15000;

    // After an agent speaks, enforce a quiet window so the system doesn't
    // immediately react to its own injected text.
    this.deps.eventBus.subscribe(EventType.AGENT_SPEAKING, () => {
      this.quietUntil = this.deps.timeProvider.now() + quietMs;
      logger.debug('[kernel] post-speech quiet window set', { quietMs, quietUntil: this.quietUntil });
    });

    this.deps.eventBus.subscribe(EventType.CONTEXT_UPDATED, (event) => {
      const now = this.deps.timeProvider.now();

      // Gate 1 — post-speech quiet window
      if (now < this.quietUntil) {
        logger.debug('[kernel] skipping wake: post-speech quiet window active', {
          remainingMs: this.quietUntil - now,
        });
        return;
      }

      // Gate 2 — minimum evaluation debounce
      if (now - this.lastEvaluationAt < debounceMs) {
        logger.debug('[kernel] skipping wake: within debounce window', {
          msSinceLast: now - this.lastEvaluationAt,
          debounceMs,
        });
        return;
      }

      // Opportunistic Wake
      this.wake(this.deps.contextEngine.getSnapshot(), event.payload.delta).catch(err => {
        logger.error('Kernel wake cycle failed', { error: String(err) });
      });
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  public async wake(snapshot: ContextSnapshot, delta: SemanticDelta): Promise<void> {
    if (!this.isRunning) return;
    
    // Concurrency / Invariant guard: only one evaluation at a time
    if (this.isEvaluating) {
      logger.debug('Kernel wake skipped: evaluation already in progress');
      return;
    }

    // Tick the budget based on real time elapsed before checking constraints
    this.deps.attentionBudget.tick();

    // Constraint check: Do we have enough budget to possibly interrupt?
    if (!this.deps.attentionBudget.canInterrupt()) {
      return;
    }

    this.isEvaluating = true;
    const tickId = randomUUID();
    this.contextVersion++;

    try {
      // 1. Map ContextSnapshot to AgentContextSnapshot (cached for this tick)
      const agentSnapshot = adaptContextSnapshot(snapshot);

      // 2. Build EvaluationContext
      const evalCtx: EvaluationContext = {
        tickId,
        contextVersion: this.contextVersion,
        snapshot: agentSnapshot,
        delta,
        blackboard: this.deps.blackboard.getState(),
        budget: this.deps.attentionBudget.getState().remaining,
        timestamp: this.deps.timeProvider.now()
      };

      // 3. Dispatch to Scheduler
      const results = await this.deps.scheduler.dispatch(evalCtx, {
        timeoutMs: this.deps.agentTimeoutMs ?? 15000
      });

      // 4. Gather proposals and new blackboard entries
      const proposals: IAgentProposal[] = [];
      const newEntries: IBlackboardEntry[] = [];
      
      for (const result of results) {
        if (result.proposal) proposals.push(result.proposal);
        if (result.blackboardEntries.length > 0) newEntries.push(...result.blackboardEntries);
      }

      // 5. Post entries to Blackboard
      if (newEntries.length > 0) {
        this.deps.blackboard.post(newEntries);
      }

      // 6. Build Arbitration Context
      const arbCtx: ArbitrationContext = {
        cycleId: tickId,
        blackboard: this.deps.blackboard.getState(),
        budgetState: this.deps.attentionBudget.getState(),
        speakerInFlow: this.deps.attentionGate.isAgentSpeaking(),
        emotionalIntensity: 0,
        recentInterruptionCount: this.deps.attentionBudget.getState().interruptionCount
      };

      // 7. Arbitrate
      let arbResult: ArbitrationResult = { granted: null, rejected: proposals, deferred: [] };
      if (proposals.length > 0) {
        arbResult = this.deps.arbitrator.evaluate(proposals, arbCtx);
      }

      // 8. Gate and Grant Token
      if (arbResult.granted) {
        const token = this.deps.attentionGate.tryGrant(arbResult.granted);
        if (token) {
          this.deps.attentionBudget.consume(10);
          
          this.deps.eventBus.publish({
            type: EventType.INTERRUPT_GRANTED,
            source: 'kernel',
            payload: {
              tickId,
              contextVersion: this.contextVersion,
              proposal: arbResult.granted,
              timestamp: this.deps.timeProvider.now()
            }
          });
        }
      }

      // 9. Rotate Blackboard (make entries visible for next tick)
      this.deps.blackboard.rotate();

    } finally {
      this.lastEvaluationAt = this.deps.timeProvider.now();
      this.isEvaluating = false;
    }
  }
}
