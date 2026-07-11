import { IBlackboardEntry, IBlackboardState } from '../shared/types';
import { IBlackboard } from './interfaces';

export class CognitiveBlackboard implements IBlackboard {
  private activeEntries: readonly IBlackboardEntry[] = Object.freeze([]);
  private pendingEntries: Map<string, IBlackboardEntry> = new Map();

  post(entries: readonly IBlackboardEntry[]): void {
    for (const entry of entries) {
      // Deduplicate on agentId and content within the pending cycle.
      const key = `${entry.agentId}:${entry.content}`;
      if (!this.pendingEntries.has(key)) {
        this.pendingEntries.set(key, entry);
      }
    }
  }

  rotate(): void {
    // Freeze once, eliminating allocation overhead during getState()
    this.activeEntries = Object.freeze(Array.from(this.pendingEntries.values()));
    this.pendingEntries.clear();
  }

  getState(): IBlackboardState {
    // Cast to IBlackboardState (which is IBlackboardEntry[]) but it remains frozen.
    return this.activeEntries as unknown as IBlackboardState;
  }
}
