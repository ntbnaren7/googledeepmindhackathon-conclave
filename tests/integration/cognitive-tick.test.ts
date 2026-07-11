import { describe, expect, it } from 'vitest';
import { ContextEngine } from '../../src/context/context-engine';
import { EventBus } from '../../src/events/event-bus';
import { EventType } from '../../src/events/event-types';
import { KnowledgeGraph } from '../../src/knowledge/knowledge-graph';

describe('cognitive tick integration', () => {
  it('propagates produced semantic deltas into context updates', () => {
    const eventBus = new EventBus();
    const knowledgeGraph = new KnowledgeGraph();
    const contextEngine = new ContextEngine(eventBus, knowledgeGraph);

    contextEngine.initialize({});
    eventBus.publish({
      type: EventType.DELTA_PRODUCED,
      source: 'perception',
      payload: {
        delta: {
          units: [
            {
              id: 'unit-1',
              speakerId: 'speaker-1',
              content: 'We should use managed Postgres',
              timestamp: 1000,
            },
          ],
          topics: [],
          decisions: [
            {
              id: 'decision-1',
              description: 'Use managed Postgres',
              status: 'proposed',
              timestamp: 1000,
            },
          ],
          assumptions: [],
          risks: [],
        },
      },
    });

    expect(contextEngine.getDecisionGraph()).toEqual([
      {
        id: 'decision-1',
        statement: 'Use managed Postgres',
        status: 'proposed',
        supporting: [],
        opposing: [],
        timestamp: 1000,
      },
    ]);
    expect(knowledgeGraph.getByType('decision')).toHaveLength(1);
    expect(
      eventBus.getHistory().filter((event) => event.type === EventType.CONTEXT_UPDATED),
    ).toHaveLength(1);
  });
});
