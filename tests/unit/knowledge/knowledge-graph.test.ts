import { describe, expect, it } from 'vitest';
import { KnowledgeGraph } from '../../../src/knowledge/knowledge-graph';
import { KnowledgeEntry } from '../../../src/shared/types';

describe('KnowledgeGraph', () => {
  it('stores entries append-only and protects internal state from caller mutation', () => {
    const graph = new KnowledgeGraph();
    const entry: KnowledgeEntry = {
      id: 'unit-1',
      type: 'statement',
      content: 'We should use managed Postgres',
      domain: 'architecture',
      speakerId: 'speaker-1',
      timestamp: 1000,
    };

    graph.store(entry);
    entry.content = 'mutated outside graph';

    expect(graph.getAll()).toEqual([
      {
        id: 'unit-1',
        type: 'statement',
        content: 'We should use managed Postgres',
        domain: 'architecture',
        speakerId: 'speaker-1',
        timestamp: 1000,
      },
    ]);
  });

  it('filters entries by semantic type using cloned results', () => {
    const graph = new KnowledgeGraph();

    graph.store({
      id: 'unit-1',
      type: 'statement',
      content: 'Architecture discussion',
      domain: 'architecture',
      timestamp: 1000,
    });
    graph.store({
      id: 'decision-1',
      type: 'decision',
      content: 'Use managed Postgres',
      domain: null,
      timestamp: 1001,
    });

    const decisions = graph.getByType('decision');
    decisions[0].content = 'mutated returned value';

    expect(decisions).toHaveLength(1);
    expect(graph.getByType('decision')[0].content).toBe('Use managed Postgres');
  });

  it('derives latest decision nodes by id', () => {
    const graph = new KnowledgeGraph();

    graph.store({
      id: 'decision-1',
      type: 'decision',
      content: 'Use self-hosted Postgres',
      domain: null,
      timestamp: 1000,
    });
    graph.store({
      id: 'decision-1',
      type: 'decision',
      content: 'Use managed Postgres',
      domain: null,
      timestamp: 2000,
    });

    expect(graph.getDecisionNodes()).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'proposed',
        supporting: [],
        opposing: [],
        timestamp: 2000,
      },
    ]);
  });

  it('exports a meeting record from stored semantic entries', () => {
    const graph = new KnowledgeGraph();

    graph.store({
      id: 'decision-1',
      type: 'decision',
      content: 'Use managed Postgres',
      domain: null,
      timestamp: 1000,
    });
    graph.store({
      id: 'assumption-1',
      type: 'assumption',
      content: 'Traffic stays below 10k users',
      domain: null,
      timestamp: 1001,
    });
    graph.store({
      id: 'risk-1',
      type: 'risk',
      content: 'Cloud cost can rise',
      domain: null,
      timestamp: 1002,
    });

    const record = graph.export();

    expect(record.generatedAt).toEqual(expect.any(Number));
    expect(record.topics).toEqual([]);
    expect(record.decisions).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'proposed',
        supporting: [],
        opposing: [],
        timestamp: 1000,
      },
    ]);
    expect(record.assumptions).toEqual([
      {
        id: 'assumption-1',
        content: 'Traffic stays below 10k users',
        status: 'active',
        sourceUnitId: 'assumption-1',
        timestamp: 1001,
      },
    ]);
    expect(record.risks).toEqual([
      {
        id: 'risk-1',
        content: 'Cloud cost can rise',
        severity: 'med',
        status: 'open',
        timestamp: 1002,
      },
    ]);
  });
});
