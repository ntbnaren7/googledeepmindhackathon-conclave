import { IAgentProposal } from '../shared/types';
import { IInterventionHistory, RecentIntervention } from './interfaces';

export class InterventionHistory implements IInterventionHistory {
  private history: RecentIntervention[] = [];

  constructor(private readonly maxHistory: number) {}

  recent(): readonly RecentIntervention[] {
    return Object.freeze([...this.history]);
  }

  record(proposal: IAgentProposal, timestamp: number): void {
    this.history.push(
      Object.freeze({
        content: proposal.content,
        agentId: proposal.agentId,
        timestamp,
      })
    );

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  size(): number {
    return this.history.length;
  }

  clear(): void {
    this.history = [];
  }
}
