import { AgentRegistry } from '../agents/agent-registry';
import {
  IAgentResult,
  IBlackboardState,
  IContextSnapshot,
  ISemanticDelta,
} from '../shared/types';
import { logger } from '../shared/logger';

/**
 * Dispatches a context snapshot + delta + blackboard to every registered agent
 * in parallel and collects their results. A single agent failing (LLM error,
 * timeout) never blocks the others — `Promise.allSettled` isolates faults.
 */
export class CognitiveScheduler {
  constructor(private readonly registry: AgentRegistry) {}

  async dispatch(
    snapshot: IContextSnapshot,
    delta: ISemanticDelta,
    blackboard: IBlackboardState,
  ): Promise<IAgentResult[]> {
    const agents = this.registry.getAll();
    const settled = await Promise.allSettled(
      agents.map((agent) => agent.evaluate(snapshot, delta, blackboard)),
    );

    const results: IAgentResult[] = [];
    for (let i = 0; i < settled.length; i += 1) {
      const outcome = settled[i];
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        logger.warn('[scheduler] agent evaluation rejected', {
          agentId: agents[i]?.id,
          reason: String(outcome.reason),
        });
      }
    }
    return results;
  }
}
