import { describe, expect, it } from 'vitest';
import { AssumptionTracker } from '../../../src/context/assumption-tracker';
import { createEmptyContextState } from '../../../src/context/context-store';
import { DecisionTracker } from '../../../src/context/decision-tracker';
import { RiskTracker } from '../../../src/context/risk-tracker';
import { TopicTracker } from '../../../src/context/topic-tracker';

describe('TopicTracker', () => {
  it('tracks the current topic and moves replaced topics into history', () => {
    const state = createEmptyContextState();
    const tracker = new TopicTracker();

    expect(
      tracker.track(state, [{ id: 'topic-1', label: 'Architecture', confidence: 0.9 }], 1000),
    ).toBe(true);
    expect(state.currentTopic).toEqual({
      id: 'topic-1',
      title: 'Architecture',
      startedAtTimestamp: 1000,
    });

    tracker.track(state, [{ id: 'topic-2', label: 'Budget', confidence: 0.7 }], 2000);

    expect(state.currentTopic?.id).toBe('topic-2');
    expect(state.topicHistory).toEqual([
      {
        id: 'topic-1',
        title: 'Architecture',
        startedAtTimestamp: 1000,
      },
    ]);
  });

  it('resumes a historical topic without duplicating it in history', () => {
    const state = createEmptyContextState();
    const tracker = new TopicTracker();

    tracker.track(state, [{ id: 'topic-1', label: 'Architecture', confidence: 0.9 }], 1000);
    tracker.track(state, [{ id: 'topic-2', label: 'Budget', confidence: 0.7 }], 2000);
    tracker.track(state, [{ id: 'topic-1', label: 'Architecture', confidence: 0.9 }], 3000);

    expect(state.currentTopic).toEqual({
      id: 'topic-1',
      title: 'Architecture',
      startedAtTimestamp: 1000,
    });
    expect(state.topicHistory).toEqual([
      {
        id: 'topic-2',
        title: 'Budget',
        startedAtTimestamp: 2000,
      },
    ]);
  });
});

describe('DecisionTracker', () => {
  it('maps and upserts decision statuses while preserving arguments', () => {
    const state = createEmptyContextState();
    const tracker = new DecisionTracker();

    tracker.track(state, [
      {
        id: 'decision-1',
        description: 'Use managed Postgres',
        status: 'proposed',
        timestamp: 1000,
      },
    ]);
    state.decisions[0].supporting.push({
      id: 'argument-1',
      content: 'Operational overhead is lower',
      stance: 'support',
      sourceUnitId: 'unit-1',
    });

    tracker.track(state, [
      {
        id: 'decision-1',
        description: 'Use managed Postgres',
        status: 'approved',
        timestamp: 1100,
      },
    ]);

    expect(state.decisions).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'decided',
        supporting: [
          {
            id: 'argument-1',
            content: 'Operational overhead is lower',
            stance: 'support',
            sourceUnitId: 'unit-1',
          },
        ],
        opposing: [],
        timestamp: 1100,
      },
    ]);
  });
});

describe('AssumptionTracker', () => {
  it('maps challenge state and preserves the original timestamp', () => {
    const state = createEmptyContextState();
    const tracker = new AssumptionTracker();

    tracker.track(
      state,
      [{ id: 'assumption-1', statement: 'Traffic stays below 10k users', challenged: false }],
      1000,
    );
    tracker.track(
      state,
      [{ id: 'assumption-1', statement: 'Traffic stays below 10k users', challenged: true }],
      2000,
    );

    expect(state.assumptions).toEqual([
      {
        id: 'assumption-1',
        content: 'Traffic stays below 10k users',
        status: 'challenged',
        sourceUnitId: 'assumption-1',
        timestamp: 1000,
      },
    ]);
  });
});

describe('RiskTracker', () => {
  it('maps numeric severities and preserves mitigation data on upsert', () => {
    const state = createEmptyContextState();
    const tracker = new RiskTracker();

    tracker.track(
      state,
      [
        { id: 'risk-low', description: 'Minor delay', severity: 0.2 },
        { id: 'risk-med', description: 'Possible cost increase', severity: 0.5 },
        { id: 'risk-high', description: 'Compliance blocker', severity: 0.8 },
      ],
      1000,
    );
    state.risks[1].mitigation = 'Cap monthly spend';

    tracker.track(
      state,
      [{ id: 'risk-med', description: 'Possible cost increase', severity: 0.7 }],
      2000,
    );

    expect(state.risks).toEqual([
      {
        id: 'risk-low',
        content: 'Minor delay',
        severity: 'low',
        status: 'open',
        timestamp: 1000,
      },
      {
        id: 'risk-med',
        content: 'Possible cost increase',
        severity: 'high',
        mitigation: 'Cap monthly spend',
        status: 'open',
        timestamp: 1000,
      },
      {
        id: 'risk-high',
        content: 'Compliance blocker',
        severity: 'high',
        status: 'open',
        timestamp: 1000,
      },
    ]);
  });
});
