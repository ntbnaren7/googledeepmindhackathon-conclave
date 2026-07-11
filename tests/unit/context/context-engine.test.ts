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

  it('links objection and agreement units to the matching decision', () => {
    const knowledgeGraph = new KnowledgeGraph();
    const engine = new ContextEngine(new EventBus(), knowledgeGraph);

    engine.handleDelta({
      units: [
        {
          id: 'unit-obj',
          speakerId: 'speaker-1',
          content: 'Managed Postgres will lock us into one cloud vendor',
          timestamp: 1000,
          type: 'objection',
        },
        {
          id: 'unit-agr',
          speakerId: 'speaker-2',
          content: 'Managed Postgres reduces our operational burden',
          timestamp: 1001,
          type: 'agreement',
        },
      ],
      topics: [],
      decisions: [
        {
          id: 'decision-1',
          description: 'Adopt managed Postgres for our database',
          status: 'proposed',
          timestamp: 999,
        },
      ],
      assumptions: [],
      risks: [],
    });

    const decision = engine.getSnapshot().decisions[0];
    expect(decision.opposing).toHaveLength(1);
    expect(decision.opposing[0].sourceUnitId).toBe('unit-obj');
    expect(decision.supporting).toHaveLength(1);
    expect(decision.supporting[0].stance).toBe('support');
    // Change D: units are stored in the knowledge graph with their real type.
    expect(knowledgeGraph.getByType('objection')).toHaveLength(1);
    expect(knowledgeGraph.getByType('agreement')).toHaveLength(1);
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

  it('exports a meeting record from live context state, not lossy KG defaults', () => {
    const engine = new ContextEngine();
    engine.handleDelta(buildDelta());

    const record = engine.exportMeetingRecord();

    expect(record.topics.map((t) => t.title)).toContain('Database architecture');
    expect(record.decisions).toHaveLength(1);
    expect(record.decisions[0].status).toBe('decided'); // real status, not 'proposed'
    expect(record.risks[0].severity).toBe('high'); // real severity, not 'med'
    expect(typeof record.generatedAt).toBe('number');
  });

  it('returns a decision graph that cannot mutate engine state', () => {
    const engine = new ContextEngine();
    engine.handleDelta(buildDelta());

    const graph = engine.getDecisionGraph();
    graph[0] = {
      ...graph[0],
      status: 'rejected',
      opposing: [
        ...graph[0].opposing,
        {
          id: 'arg2',
          content: 'That might delay the launch.',
          stance: 'oppose',
          speakerId: 'B',
          sourceUnitId: 'u2',
        }
      ]
    };

    expect(engine.getDecisionGraph()[0].status).toBe('decided');
    expect(engine.getDecisionGraph()[0].opposing).toHaveLength(0);
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
