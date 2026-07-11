import { IStakeholderAgent } from './interfaces';

export class AgentRegistry {
  private agents = new Map<string, IStakeholderAgent>();
  register(agent: IStakeholderAgent) { this.agents.set(agent.id, agent); }
  getAgent(id: string) { return this.agents.get(id); }
  getAll() { return Array.from(this.agents.values()); }
}
