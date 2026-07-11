import {
  ContextSnapshot,
  ContextState,
  DecisionNode,
  MeetingRecord,
  SemanticDelta,
} from '../shared/types';

export interface IContextStore {
  getState(): ContextState;
  update(mutator: (state: ContextState) => void): void;
  reset(): void;
}

export interface IContextProjector {
  project(state: ContextState): ContextSnapshot;
}

export interface IContextEngine {
  initialize(config: unknown): void;
  handleDelta(delta: SemanticDelta): void;
  getSnapshot(): ContextSnapshot;
  getDecisionGraph(): DecisionNode[];
  exportMeetingRecord(): MeetingRecord;
  reset(): void;
}
