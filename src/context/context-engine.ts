import { IEventBus } from '../events/interfaces';
import { EventType } from '../events/event-types';
import { ContextSnapshot, DecisionNode, SemanticDelta } from '../shared/types';
import { IKnowledgeGraph } from '../knowledge/interfaces';
import { KnowledgeGraph } from '../knowledge/knowledge-graph';
import { AssumptionTracker } from './assumption-tracker';
import { ContextProjector } from './context-projector';
import { ContextStore } from './context-store';
import { DecisionTracker } from './decision-tracker';
import { IContextEngine } from './interfaces';
import { RiskTracker } from './risk-tracker';
import { TopicTracker } from './topic-tracker';

const SOURCE = 'context';

export class ContextEngine implements IContextEngine {
  private readonly store = new ContextStore();
  private readonly projector = new ContextProjector();
  private readonly topicTracker = new TopicTracker();
  private readonly decisionTracker = new DecisionTracker();
  private readonly assumptionTracker = new AssumptionTracker();
  private readonly riskTracker = new RiskTracker();

  constructor(
    private readonly eventBus?: IEventBus,
    private readonly knowledgeGraph: IKnowledgeGraph = new KnowledgeGraph(),
  ) {}

  initialize(_config: unknown): void {
    this.eventBus?.subscribe(EventType.DELTA_PRODUCED, (event) => {
      this.handleDelta(event.payload.delta);
    });
  }

  handleDelta(delta: SemanticDelta): void {
    if (isEmptyDelta(delta)) return;

    const timestamp = resolveDeltaTimestamp(delta);
    let contextChanged = false;

    this.store.update((state) => {
      const topicChanged = this.topicTracker.track(state, delta.topics, timestamp);
      const decisionChanged = this.decisionTracker.track(state, delta.decisions);
      const assumptionChanged = this.assumptionTracker.track(
        state,
        delta.assumptions,
        timestamp,
      );
      const riskChanged = this.riskTracker.track(state, delta.risks, timestamp);

      contextChanged =
        topicChanged || decisionChanged || assumptionChanged || riskChanged;
    });

    const knowledgeChanged = this.storeKnowledgeEntries(delta, timestamp);
    if (!contextChanged && !knowledgeChanged) return;

    const snapshot = this.getSnapshot();
    this.eventBus?.publish({
      type: EventType.CONTEXT_UPDATED,
      source: SOURCE,
      payload: { snapshotId: snapshot.id },
    });
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

  private storeKnowledgeEntries(delta: SemanticDelta, timestamp: number): boolean {
    let storedCount = 0;

    for (const unit of delta.units) {
      this.knowledgeGraph.store({
        id: unit.id,
        type: 'statement',
        content: unit.content,
        domain: null,
        speakerId: unit.speakerId,
        timestamp: unit.timestamp,
      });
      storedCount += 1;
    }

    for (const decision of delta.decisions) {
      this.knowledgeGraph.store({
        id: decision.id,
        type: 'decision',
        content: decision.description,
        domain: null,
        timestamp: decision.timestamp,
      });
      storedCount += 1;
    }

    for (const assumption of delta.assumptions) {
      this.knowledgeGraph.store({
        id: assumption.id,
        type: 'assumption',
        content: assumption.statement,
        domain: null,
        timestamp,
      });
      storedCount += 1;
    }

    for (const risk of delta.risks) {
      this.knowledgeGraph.store({
        id: risk.id,
        type: 'risk',
        content: risk.description,
        domain: null,
        timestamp,
      });
      storedCount += 1;
    }

    return storedCount > 0;
  }
}

function isEmptyDelta(delta: SemanticDelta): boolean {
  return (
    delta.units.length === 0 &&
    delta.topics.length === 0 &&
    delta.decisions.length === 0 &&
    delta.assumptions.length === 0 &&
    delta.risks.length === 0
  );
}

function resolveDeltaTimestamp(delta: SemanticDelta): number {
  const unitTimestamp = delta.units.find((unit) => Number.isFinite(unit.timestamp))
    ?.timestamp;
  const decisionTimestamp = delta.decisions.find((decision) =>
    Number.isFinite(decision.timestamp),
  )?.timestamp;

  return unitTimestamp ?? decisionTimestamp ?? Date.now();
}
