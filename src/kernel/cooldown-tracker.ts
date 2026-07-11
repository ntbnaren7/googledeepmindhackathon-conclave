import { IAgentCooldownTracker } from './interfaces';

export class AgentCooldownTracker implements IAgentCooldownTracker {
  private lastInterventionTime: Map<string, number> = new Map();

  constructor(private readonly cooldownMs: number) {}

  isOnCooldown(agentId: string, now: number): boolean {
    const lastTime = this.lastInterventionTime.get(agentId);
    if (lastTime === undefined) {
      return false;
    }
    return now - lastTime < this.cooldownMs;
  }

  recordIntervention(agentId: string, now: number): void {
    this.lastInterventionTime.set(agentId, now);
  }
}
