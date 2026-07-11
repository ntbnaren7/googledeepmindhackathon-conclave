import { describe, expect, it } from 'vitest';
import { Orchestrator } from '../../src/integration/orchestrator';
import { ContextEngine } from '../../src/context/context-engine';
import { KnowledgeGraph } from '../../src/knowledge/knowledge-graph';
import { CognitiveScheduler } from '../../src/kernel/cognitive-scheduler';
import { AgentRegistry } from '../../src/agents/agent-registry';
import { CTOAgent } from '../../src/agents/cto-agent';
import { ProductAgent } from '../../src/agents/product-agent';
import { FinanceAgent } from '../../src/agents/finance-agent';
import { ResearchAgent } from '../../src/agents/research-agent';
import { MockLlmClient } from '../../src/agents/mock-llm-client';
import { Arbitrator } from '../../src/kernel/arbitrator';
import { CognitiveBlackboard } from '../../src/kernel/blackboard';
import { AttentionGate } from '../../src/kernel/attention-gate';
import { AttentionBudget } from '../../src/kernel/attention-budget';
import { InterventionHistory } from '../../src/kernel/intervention-history';
import { AgentCooldownTracker } from '../../src/kernel/cooldown-tracker';
import { similarityScore } from '../../src/context/matcher';
import type { ITimeProvider, ISemanticComparator } from '../../src/kernel/interfaces';
import type { SemanticDelta } from '../../src/shared/types';
import type { UIMessage, UIMessageKind } from '../../src/ui/types';

function buildOrchestrator(collected: UIMessage[]) {
  const timeProvider: ITimeProvider = { now: () => Date.now() };
  const contextEngine = new ContextEngine(undefined, new KnowledgeGraph());

  const llm = new MockLlmClient();
  const registry = new AgentRegistry();
  registry.register(new CTOAgent(llm));
  registry.register(new ProductAgent(llm));
  registry.register(new FinanceAgent(llm));
  registry.register(new ResearchAgent(llm));

  const comparator: ISemanticComparator = { similarity: (a, b) => similarityScore(a, b) };
  const arbitrator = new Arbitrator(
    comparator,
    new InterventionHistory(20),
    new AgentCooldownTracker(30000),
    timeProvider,
  );

  return new Orchestrator({
    contextEngine,
    scheduler: new CognitiveScheduler(registry),
    registry,
    arbitrator,
    attentionGate: new AttentionGate({ speakingTimeoutMs: 8000 }, timeProvider),
    attentionBudget: new AttentionBudget(
      {
        initialBudget: 100,
        replenishRate: 5,
        interruptionBaseCost: 10,
        cooldownMs: 30000,
        minThreshold: 0.3,
      },
      timeProvider,
    ),
    blackboard: new CognitiveBlackboard(),
    timeProvider,
    broadcast: (message) => collected.push(message),
  });
}

function delta(): SemanticDelta {
  return {
    units: [
      {
        id: 'u1',
        speakerId: 'Priya',
        content: 'We should migrate our platform to Kubernetes',
        timestamp: 1000,
        type: 'proposal',
      },
    ],
    topics: [{ id: 't1', label: 'Kubernetes migration', confidence: 0.9 }],
    decisions: [
      { id: 'd1', description: 'Migrate to Kubernetes', status: 'proposed', timestamp: 1000 },
    ],
    assumptions: [{ id: 'a1', statement: 'Traffic stays under 10k users', challenged: false }],
    risks: [{ id: 'r1', description: 'Operational complexity is high', severity: 0.7 }],
  };
}

describe('Orchestrator end-to-end cycle', () => {
  it('emits a full set of UI messages from one delta', async () => {
    const collected: UIMessage[] = [];
    const orchestrator = buildOrchestrator(collected);

    await orchestrator.enqueue(delta());

    const kinds = new Set<UIMessageKind>(collected.map((m) => m.kind));
    for (const expected of ['transcript', 'context', 'stakeholder', 'budget', 'decision'] as const) {
      expect(kinds.has(expected)).toBe(true);
    }

    const context = collected.find((m) => m.kind === 'context');
    expect(context && context.kind === 'context' && context.context.topic).toBe(
      'Kubernetes migration',
    );

    // At least one agent proposed and the arbitrator produced an intervention.
    const interventions = collected.filter((m) => m.kind === 'intervention');
    expect(interventions.length).toBeGreaterThan(0);
    expect(
      interventions.some((m) => m.kind === 'intervention' && m.intervention.state === 'granted'),
    ).toBe(true);

    // The granted agent produced a spoken response (used as the intervention note).
    const granted = interventions.find(
      (m) => m.kind === 'intervention' && m.intervention.state === 'granted',
    );
    expect(
      granted && granted.kind === 'intervention' && (granted.intervention.note ?? '').length,
    ).toBeGreaterThan(0);
  });

  it('drops the budget after an intervention is granted', async () => {
    const collected: UIMessage[] = [];
    const orchestrator = buildOrchestrator(collected);

    await orchestrator.enqueue(delta());

    const budget = collected.filter((m) => m.kind === 'budget').at(-1);
    expect(budget && budget.kind === 'budget' && budget.budget.interruptions).toBe(1);
    expect(budget && budget.kind === 'budget' && budget.budget.percent).toBeLessThan(100);
  });
});
