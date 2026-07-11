import { ContextEngine } from '../context/context-engine';
import { CognitiveScheduler } from '../kernel/cognitive-scheduler';
import {
  IArbitrator,
  IAttentionBudget,
  IAttentionGate,
  IBlackboard,
  ITimeProvider,
  ArbitrationContext,
} from '../kernel/interfaces';
import { AgentRegistry } from '../agents/agent-registry';
import { ISpeechOutput } from '../output/interfaces';
import { IAgentProposal, SemanticDelta } from '../shared/types';
import { generateId } from '../shared/id-generator';
import { logger } from '../shared/logger';
import type { AgentId, InterventionState, UIMessage } from '../ui/types';
import { toIContextSnapshot } from './snapshot-adapter';

const AGENT_IDS: readonly AgentId[] = ['cto', 'product', 'finance', 'research'];

export interface OrchestratorDeps {
  contextEngine: ContextEngine;
  scheduler: CognitiveScheduler;
  registry: AgentRegistry;
  arbitrator: IArbitrator;
  attentionGate: IAttentionGate;
  attentionBudget: IAttentionBudget;
  blackboard: IBlackboard;
  timeProvider: ITimeProvider;
  broadcast: (message: UIMessage) => void;
  speech?: ISpeechOutput;
  interruptionCost?: number;
}

/**
 * The integration layer. On every `DELTA_PRODUCED` it runs one cognitive cycle
 * — update world model → snapshot → dispatch to agents → arbitrate → grant &
 * speak — and emits normalized `UIMessage`s for the front end. Deltas are
 * processed strictly in order via an internal promise chain so cycles never
 * interleave.
 */
export class Orchestrator {
  private readonly deps: OrchestratorDeps;
  private readonly interruptionCost: number;
  private readonly speakerIndex = new Map<string, number>();
  private readonly lastInterventionAt = new Map<string, number>();
  private queue: Promise<void> = Promise.resolve();
  private tick = 0;

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
    this.interruptionCost = deps.interruptionCost ?? 10;
  }

  /** Enqueue a delta for sequential processing. Returns when this delta is done. */
  enqueue(delta: SemanticDelta): Promise<void> {
    this.queue = this.queue
      .then(() => this.handleDelta(delta))
      .catch((error) => {
        logger.error('[orchestrator] cycle failed', { error: String(error) });
      });
    return this.queue;
  }

  private async handleDelta(delta: SemanticDelta): Promise<void> {
    this.tick += 1;
    const tickId = this.tick;
    const b = this.deps;

    // 1. Transcript lines from the raw units.
    for (const unit of delta.units) {
      b.broadcast({
        kind: 'transcript',
        line: {
          id: unit.id,
          speaker: unit.speakerId,
          speakerIndex: this.indexFor(unit.speakerId),
          text: unit.content,
        },
      });
    }

    // 2. Update the world model, then read an immutable snapshot.
    b.contextEngine.handleDelta(delta);
    const snapshot = b.contextEngine.getSnapshot();
    const iSnapshot = toIContextSnapshot(snapshot);

    // 3. Context panel.
    b.broadcast({
      kind: 'context',
      context: {
        topic: snapshot.currentTopic?.title ?? 'Discussion',
        assumptions: snapshot.assumptions.map((a) => a.content),
        decisions: snapshot.decisions.map((d) => d.statement),
        risks: snapshot.risks.map((r) => r.content),
      },
    });

    // 4. Agents start thinking.
    this.broadcastAllStatus('thinking');

    // 5. Dispatch to every agent in parallel.
    const results = await b.scheduler.dispatch(iSnapshot, delta, b.blackboard.getState());

    // 6. Back to idle.
    this.broadcastAllStatus('idle');

    // 7. Collect proposals; post + surface blackboard entries.
    const proposals: IAgentProposal[] = [];
    for (const result of results) {
      if (result.proposal) proposals.push(result.proposal);
      if (result.blackboardEntries.length > 0) {
        b.blackboard.post(result.blackboardEntries);
        for (const entry of result.blackboardEntries) {
          b.broadcast({
            kind: 'blackboard',
            entry: {
              id: generateId(),
              agent: this.asAgent(entry.agentId),
              type: 'observation',
              content: entry.content,
              tickId,
            },
          });
        }
      }
    }

    // 8. Replenish budget, then arbitrate.
    b.attentionBudget.tick();
    const arbitrationContext: ArbitrationContext = {
      cycleId: generateId(),
      blackboard: b.blackboard.getState(),
      budgetState: b.attentionBudget.getState(),
      speakerInFlow: b.attentionGate.isAgentSpeaking(),
      emotionalIntensity: 0,
      recentInterruptionCount: b.attentionBudget.getState().interruptionCount,
    };
    const arbitration =
      proposals.length > 0
        ? b.arbitrator.evaluate(proposals, arbitrationContext)
        : { granted: null, rejected: [], deferred: [] };

    // 9. Rejected / deferred proposals as intervention chips.
    for (const proposal of arbitration.deferred) {
      this.emitIntervention(proposal, 'deferred', 'Budget low — only critical insights interrupt.');
    }
    for (const proposal of arbitration.rejected) {
      this.emitIntervention(proposal, 'rejected');
    }

    // 10. Grant → speak.
    if (arbitration.granted) {
      await this.grantFloor(arbitration.granted, iSnapshot);
    }

    // 11. Budget panel.
    this.broadcastBudget();

    // 12. Decision graph.
    for (const decision of snapshot.decisions) {
      b.broadcast({
        kind: 'decision',
        decision: {
          id: decision.id,
          label: decision.statement,
          arguments: [
            ...decision.supporting.map((arg) => ({ text: arg.content, kind: 'support' as const })),
            ...decision.opposing.map((arg) => ({ text: arg.content, kind: 'oppose' as const })),
          ],
        },
      });
    }

    // 13. Freeze this cycle's blackboard for the next one.
    b.blackboard.rotate();
  }

  private async grantFloor(
    granted: IAgentProposal,
    iSnapshot: ReturnType<typeof toIContextSnapshot>,
  ): Promise<void> {
    const b = this.deps;
    if (!b.attentionBudget.canInterrupt()) {
      this.emitIntervention(granted, 'deferred', 'Attention budget exhausted.');
      return;
    }

    const token = b.attentionGate.tryGrant(granted);
    if (!token) {
      this.emitIntervention(granted, 'deferred', 'Another agent holds the floor.');
      return;
    }

    b.attentionBudget.consume(this.interruptionCost);
    b.blackboard.post([
      { agentId: granted.agentId, content: granted.content, timestamp: b.timeProvider.now() },
    ]);

    let note = granted.content;
    const agent = b.registry.getAgent(granted.agentId);
    if (agent) {
      try {
        const response = await agent.generateResponse(iSnapshot, granted);
        if (response.content) note = response.content;

        // Tell the browser to speak the agent's response aloud via TTS.
        const agentId = this.asAgent(granted.agentId);
        b.broadcast({ kind: 'agent-speak', agent: agentId, text: note });

        if (b.speech) await b.speech.speak(response);
      } catch (error) {
        logger.warn('[orchestrator] response generation failed', { error: String(error) });
      }
    }

    const now = b.timeProvider.now();
    this.lastInterventionAt.set(granted.agentId, now);
    const agentIdForStatus = this.asAgent(granted.agentId);
    b.broadcast({
      kind: 'stakeholder',
      stakeholder: { id: agentIdForStatus, status: 'speaking', lastInterventionAt: now },
    });
    this.emitIntervention(granted, 'granted', note);
    b.attentionGate.onSpeechComplete(token.tokenId);
    b.broadcast({
      kind: 'stakeholder',
      stakeholder: { id: agentIdForStatus, status: 'idle', lastInterventionAt: now },
    });
  }

  private emitIntervention(
    proposal: IAgentProposal,
    state: InterventionState,
    note?: string,
  ): void {
    this.deps.broadcast({
      kind: 'intervention',
      intervention: {
        id: generateId(),
        agent: this.asAgent(proposal.agentId),
        urgency: proposal.urgency,
        state,
        note,
      },
    });
  }

  private broadcastAllStatus(status: 'thinking' | 'idle'): void {
    for (const id of AGENT_IDS) {
      this.deps.broadcast({
        kind: 'stakeholder',
        stakeholder: { id, status, lastInterventionAt: this.lastInterventionAt.get(id) ?? null },
      });
    }
  }

  private broadcastBudget(): void {
    const state = this.deps.attentionBudget.getState();
    const cooldownMs =
      state.isInCooldown && state.cooldownEndsAt !== null
        ? Math.max(0, state.cooldownEndsAt - this.deps.timeProvider.now())
        : 0;
    this.deps.broadcast({
      kind: 'budget',
      budget: {
        percent: Math.round((state.remaining / state.max) * 100),
        interruptions: state.interruptionCount,
        threshold: Math.round(state.dynamicThreshold * 100) / 100,
        cooldownMs,
      },
    });
  }

  private indexFor(speakerId: string): number {
    if (!this.speakerIndex.has(speakerId)) {
      this.speakerIndex.set(speakerId, this.speakerIndex.size);
    }
    return this.speakerIndex.get(speakerId) ?? 0;
  }

  private asAgent(id: string): AgentId {
    return (AGENT_IDS as readonly string[]).includes(id) ? (id as AgentId) : 'cto';
  }
}
