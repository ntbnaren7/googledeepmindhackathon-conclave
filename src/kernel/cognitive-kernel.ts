import { ICognitiveKernel, IArbitrator, IBlackboard, IAttentionGate, IAttentionBudget, ITimeProvider, ArbitrationContext } from './interfaces';
import { IAgentProposal, IBlackboardEntry, ArbitrationResult } from '../shared/types';
import { randomUUID } from 'crypto';

export interface KernelDependencies {
  readonly arbitrator: IArbitrator;
  readonly blackboard: IBlackboard;
  readonly attentionGate: IAttentionGate;
  readonly attentionBudget: IAttentionBudget;
  readonly timeProvider: ITimeProvider;
}

export class CognitiveKernel implements ICognitiveKernel {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private pendingProposals: IAgentProposal[] = [];

  constructor(private readonly deps: KernelDependencies) {}

  async start(config: { tickIntervalMs: number } = { tickIntervalMs: 1000 }): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.timer = setInterval(() => {
      this.executeTick();
    }, config.tickIntervalMs);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Agents or EventBus submit proposals to the current cycle.
   */
  public submitProposal(proposal: IAgentProposal): void {
    this.pendingProposals.push(proposal);
  }

  /**
   * The central cognitive loop. Runs every tick.
   */
  public async executeTick(): Promise<void> {
    const cycleId = randomUUID();
    const proposals = [...this.pendingProposals];
    this.pendingProposals = []; // Clear for next cycle

    // 1. Tick the budget (replenish and decay thresholds)
    this.deps.attentionBudget.tick();

    // 2. Build Arbitration Context
    const context: ArbitrationContext = {
      cycleId,
      blackboard: this.deps.blackboard.getState(),
      budgetState: this.deps.attentionBudget.getState(),
      speakerInFlow: this.deps.attentionGate.isAgentSpeaking(),
      emotionalIntensity: 0, // Placeholder for future integration
      recentInterruptionCount: this.deps.attentionBudget.getState().interruptionCount
    };

    // 3. Evaluate Proposals
    let result: ArbitrationResult = { granted: null, rejected: proposals, deferred: [] };
    if (proposals.length > 0) {
      result = this.deps.arbitrator.evaluate(proposals, context);
    }

    // 4. Apply Arbitrator Decision
    if (result.granted) {
      // If we have budget to interrupt
      if (this.deps.attentionBudget.canInterrupt()) {
        const token = this.deps.attentionGate.tryGrant(result.granted);
        if (token) {
          // Typically consume the base cost of interruption
          // We assume a base cost of 10 for standard interventions if not exported.
          this.deps.attentionBudget.consume(10); 
          
          // Post the winner to the blackboard
          this.deps.blackboard.post([{
            agentId: result.granted.agentId,
            content: result.granted.content,
            timestamp: this.deps.timeProvider.now()
          }]);
        }
      }
    }

    // 5. Rotate Blackboard (freezes pending entries into active pool for the next cycle)
    this.deps.blackboard.rotate();
  }
}
