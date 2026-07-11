import { IEventBus } from '../events/interfaces';
import { EventType } from '../events/event-types';
import { ContextSnapshot, DecisionNode, SemanticDelta } from '../shared/types';
import { ContextProjector } from './context-projector';
import { ContextStore } from './context-store';
import { IContextEngine } from './interfaces';

export class ContextEngine implements IContextEngine {
  private readonly store = new ContextStore();
  private readonly projector = new ContextProjector();

  constructor(private readonly eventBus?: IEventBus) {}

  initialize(_config: unknown): void {
    this.eventBus?.subscribe(EventType.DELTA_PRODUCED, (event) => {
      this.handleDelta(event.payload.delta);
    });
  }

  handleDelta(_delta: SemanticDelta): void {
    // Routing into trackers lands in the next context-core implementation step.
  }

  getSnapshot(): ContextSnapshot {
    return this.projector.project(this.store.getState());
  }

  getDecisionGraph(): DecisionNode[] {
    return this.store.getState().decisions;
  }

  reset(): void {
    this.store.reset();
  }
}
