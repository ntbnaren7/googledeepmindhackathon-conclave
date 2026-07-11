import { ICognitiveScheduler, EvaluationContext, SchedulerConfig } from './interfaces';
import { IStakeholderAgent } from '../agents/interfaces';
import { IAgentResult } from '../shared/types';
import { logger } from '../shared/logger';

export class CognitiveScheduler implements ICognitiveScheduler {
  constructor(private readonly agents: readonly IStakeholderAgent[]) {}

  async dispatch(ctx: EvaluationContext, config: SchedulerConfig = { timeoutMs: 15000 }): Promise<IAgentResult[]> {
    logger.debug('Scheduler dispatching evaluation context', { tickId: ctx.tickId, agentCount: this.agents.length });

    const promises = this.agents.map(async (agent) => {
      try {
        const timeoutPromise = new Promise<IAgentResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent ${agent.id} timed out after ${config.timeoutMs}ms`)), config.timeoutMs)
        );
        const evalPromise = agent.evaluate(ctx.snapshot, ctx.delta, ctx.blackboard);
        return await Promise.race([evalPromise, timeoutPromise]);
      } catch (err) {
        logger.error('Agent evaluation failed', { agentId: agent.id, error: String(err) });
        throw err;
      }
    });

    const results = await Promise.allSettled(promises);
    
    // Explicit Failure Policy: Continue with successful agents, ignore failed.
    const successfulResults: IAgentResult[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      }
    }

    return successfulResults;
  }
}
