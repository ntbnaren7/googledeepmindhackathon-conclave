import { describe, expect, it } from 'vitest';
import { ContextEngine } from '../../../src/context/context-engine';
import { EventBus } from '../../../src/events/event-bus';
import { EventType } from '../../../src/events/event-types';
import { KnowledgeGraph } from '../../../src/knowledge/knowledge-graph';
import { SemanticDelta } from '../../../src/shared/types';

function buildDelta(): SemanticDelta {
  return {
    units: [
      {
        id: 'unit-1',
        speakerId: 'speaker-1',
        content: 'We should use managed Postgres',
        timestamp: 1000,
      },
    ],
    topics: [{ id: 'topic-1', label: 'Database architecture', confidence: 0.9 }],
    decisions: [
      {
        id: 'decision-1',
        description: 'Use managed Postgres',
        status: 'approved',
        timestamp: 1001,
      },
    ],
    assumptions: [
      {
        id: 'assumption-1',
        statement: 'Traffic stays below 10k users',
        challenged: false,
      },
    ],
    risks: [
      {
        id: 'risk-1',
        description: 'Cloud cost can rise',
        severity: 0.7,
      },
    ],
  };
}

describe('ContextEngine', () => {
  it('applies semantic deltas to context state and stores knowledge entries', () => {
    const eventBus = new EventBus();
    const knowledgeGraph = new KnowledgeGraph();
    const engine = new ContextEngine(eventBus, knowledgeGraph);

    engine.handleDelta(buildDelta());

    const snapshot = engine.getSnapshot();
    expect(snapshot.currentTopic).toEqual({
      id: 'topic-1',
      title: 'Database architecture',
      startedAtTimestamp: 1000,
    });
    expect(snapshot.decisions).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'decided',
        supporting: [],
        opposing: [],
        timestamp: 1001,
      },
    ]);
    expect(snapshot.assumptions).toEqual([
      {
        id: 'assumption-1',
        content: 'Traffic stays below 10k users',
        status: 'active',
        sourceUnitId: 'assumption-1',
        timestamp: 1000,
      },
    ]);
    expect(snapshot.risks).toEqual([
      {
        id: 'risk-1',
        content: 'Cloud cost can rise',
        severity: 'high',
        status: 'open',
        timestamp: 1000,
      },
    ]);

    expect(knowledgeGraph.getAll()).toEqual([
      {
        id: 'unit-1',
        type: 'statement',
        content: 'We should use managed Postgres',
        domain: null,
        speakerId: 'speaker-1',
        timestamp: 1000,
      },
      {
        id: 'decision-1',
        type: 'decision',
        content: 'Use managed Postgres',
        domain: null,
        timestamp: 1001,
      },
      {
        id: 'assumption-1',
        type: 'assumption',
        content: 'Traffic stays below 10k users',
        domain: null,
        timestamp: 1000,
      },
      {
        id: 'risk-1',
        type: 'risk',
        content: 'Cloud cost can rise',
        domain: null,
        timestamp: 1000,
      },
    ]);

    const contextEvents = eventBus
      .getHistory()
      .filter((event) => event.type === EventType.CONTEXT_UPDATED);
    expect(contextEvents).toHaveLength(1);
    expect(contextEvents[0].payload.snapshotId).toEqual(expect.any(String));
  });

  it('subscribes to DELTA_PRODUCED during initialization', () => {
    const eventBus = new EventBus();
    const engine = new ContextEngine(eventBus);

    engine.initialize({});
    eventBus.publish({
      type: EventType.DELTA_PRODUCED,
      source: 'perception',
      payload: { delta: buildDelta() },
    });

    expect(engine.getDecisionGraph()).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'decided',
        supporting: [],
        opposing: [],
        timestamp: 1001,
      },
    ]);
    expect(
      eventBus.getHistory().filter((event) => event.type === EventType.CONTEXT_UPDATED),
    ).toHaveLength(1);
  });

  it('ignores empty deltas without publishing context updates', () => {
    const eventBus = new EventBus();
    const knowledgeGraph = new KnowledgeGraph();
    const engine = new ContextEngine(eventBus, knowledgeGraph);

    engine.handleDelta({
      units: [],
      topics: [],
      decisions: [],
      assumptions: [],
      risks: [],
    });

    expect(knowledgeGraph.getAll()).toEqual([]);
    expect(
      eventBus.getHistory().filter((event) => event.type === EventType.CONTEXT_UPDATED),
    ).toHaveLength(0);
  });

  it('resets the working context state', () => {
    const engine = new ContextEngine();

    engine.handleDelta(buildDelta());
    expect(engine.getDecisionGraph()).toHaveLength(1);

    engine.reset();

    expect(engine.getSnapshot().decisions).toEqual([]);
    expect(engine.getSnapshot().currentTopic).toBeNull();
  });
});
