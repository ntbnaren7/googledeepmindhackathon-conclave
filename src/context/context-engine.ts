import { IEventBus } from '../events/interfaces';
import { EventType } from '../events/event-types';
import {
  Argument,
  ContextSnapshot,
  ContextState,
  DecisionNode,
  ISemanticUnit,
  MeetingRecord,
  SemanticDelta,
} from '../shared/types';
import { generateId } from '../shared/id-generator';
import { IKnowledgeGraph } from '../knowledge/interfaces';
import { KnowledgeGraph } from '../knowledge/knowledge-graph';
import { AssumptionTracker } from './assumption-tracker';
import { ContextProjector } from './context-projector';
import { ContextStore } from './context-store';
import { DecisionTracker } from './decision-tracker';
import { IContextEngine } from './interfaces';
import { bestMatchIndex } from './matcher';
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
      // Link objection/agreement units to the decision they argue about. Runs
      // after decisionTracker so decisions from this same delta are matchable.
      const argumentChanged = linkArgumentUnits(state, delta.units);

      contextChanged =
        topicChanged ||
        decisionChanged ||
        assumptionChanged ||
        riskChanged ||
        argumentChanged;
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
    // Clone so callers cannot mutate the engine's internal decision state.
    return structuredClone(this.store.getState().decisions);
  }

  /**
   * Authoritative Meeting Record built from the live context state (real
   * statuses, severities and topics), not from the flat knowledge log. The
   * knowledge graph remains the raw append-only history; this is the "truth".
   */
  exportMeetingRecord(): MeetingRecord {
    const state = this.store.getState();
    const topics = state.currentTopic
      ? [...state.topicHistory, state.currentTopic]
      : [...state.topicHistory];

    return structuredClone({
      topics,
      decisions: state.decisions,
      assumptions: state.assumptions,
      risks: state.risks,
      interventions: state.interventions,
      generatedAt: Date.now(),
    });
  }

  reset(): void {
    this.store.reset();
  }

  private storeKnowledgeEntries(delta: SemanticDelta, timestamp: number): boolean {
    let storedCount = 0;

    for (const unit of delta.units) {
      this.knowledgeGraph.store({
        id: unit.id,
        type: unit.type ?? 'statement',
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

function linkArgumentUnits(state: ContextState, units: readonly ISemanticUnit[]): boolean {
  let changed = false;

  for (const unit of units) {
    if (unit.type !== 'objection' && unit.type !== 'agreement') continue;

    const index = bestMatchIndex(unit.content, state.decisions, (d) => d.statement);
    if (index < 0) continue;

    const decision = state.decisions[index];
    const stance: Argument['stance'] = unit.type === 'objection' ? 'oppose' : 'support';
    const target = stance === 'oppose' ? decision.opposing : decision.supporting;
    // Idempotent: the same unit must not attach twice on re-processing.
    if (target.some((argument) => argument.sourceUnitId === unit.id)) continue;

    target.push({
      id: generateId(),
      content: unit.content,
      stance,
      speakerId: unit.speakerId,
      sourceUnitId: unit.id,
    });
    changed = true;
  }

  return changed;
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
