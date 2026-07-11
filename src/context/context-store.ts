import { ContextState } from '../shared/types';
import { IContextStore } from './interfaces';

export function createEmptyContextState(): ContextState {
  return {
    currentTopic: null,
    topicHistory: [],
    decisions: [],
    assumptions: [],
    risks: [],
    interventions: [],
  };
}

export class ContextStore implements IContextStore {
  private state: ContextState = createEmptyContextState();

  getState(): ContextState {
    return this.state;
  }

  update(mutator: (state: ContextState) => void): void {
    mutator(this.state);
  }

  reset(): void {
    this.state = createEmptyContextState();
  }
}
