import { IStakeholderAgent } from "./interfaces";

// ---------------------------------------------------------------------------
// AgentRegistry
// ---------------------------------------------------------------------------

/**
 * Manages the lifecycle of stakeholder agents.
 *
 * Responsibilities:
 *   - Register new agents
 *   - Remove agents by ID
 *   - Retrieve a single agent by ID
 *   - Retrieve all registered agents
 *   - Reset all agents (clear per-cycle state)
 *
 * This class does NOT contain:
 *   - Evaluation logic
 *   - Scheduling logic
 *   - Arbitration logic
 *   - Perception logic
 *
 * It is a pure container for agent instances.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, IStakeholderAgent>();

  /**
   * Register an agent. If an agent with the same ID already exists,
   * it is replaced and the old agent is removed.
   */
  register(agent: IStakeholderAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Remove an agent by ID.
   * Returns the removed agent, or undefined if no agent was found.
   */
  remove(id: string): IStakeholderAgent | undefined {
    const agent = this.agents.get(id);
    if (agent) {
      this.agents.delete(id);
    }
    return agent;
  }

  /**
   * Retrieve a single agent by ID.
   * Returns undefined if no agent is registered with that ID.
   */
  getAgent(id: string): IStakeholderAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Retrieve all registered agents as an array.
   * Returns an empty array if no agents are registered.
   */
  getAll(): IStakeholderAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Reset all registered agents (clears proposal history, etc.).
   * Call this at the start of each meeting cycle.
   */
  resetAll(): void {
    for (const agent of this.agents.values()) {
      agent.reset();
    }
  }

  /**
   * Returns the number of registered agents.
   */
  get size(): number {
    return this.agents.size;
  }
}
