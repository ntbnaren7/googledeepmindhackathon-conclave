import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAgent } from '../../../src/agents/base-agent';
import {
  IBlackboardState,
  IContextSnapshot,
  IAgentProposal,
  ISemanticDelta,
} from '../../../src/shared/types';

class TestAgent extends BaseAgent {
  id = 'test-agent';
  role = 'Test stakeholder';
  responsibilities = ['Review meeting context'];
  prompts: string[];

  constructor(outputs: string[]) {
    const prompts: string[] = [];
    super({
      generate: async (prompt: string) => {
        prompts.push(prompt);
        return outputs.shift() ?? '';
      },
    });
    this.prompts = prompts;
  }
}

const snapshot: IContextSnapshot = {
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
  timestamp: 1000,
};

const delta: ISemanticDelta = {
  units: [],
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
};

describe('BaseAgent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('evaluates model output into a proposal and blackboard entries', async () => {
    const agent = new TestAgent([
      JSON.stringify({
        proposal: {
          agentId: 'model-agent',
          content: 'Clarify the database migration timeline',
          urgency: 0.8,
        },
        blackboardEntries: [{ content: 'Timeline risk noted' }],
      }),
    ]);

    const result = await agent.evaluate(snapshot, delta, []);

    expect(agent.prompts[0]).toContain('Test stakeholder');
    expect(result.proposal).toEqual({
      agentId: 'test-agent',
      content: 'Clarify the database migration timeline',
      urgency: 0.8,
    });
    expect(result.blackboardEntries).toEqual([
      {
        agentId: 'test-agent',
        content: 'Timeline risk noted',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('generates a spoken response from model output', async () => {
    const agent = new TestAgent([
      JSON.stringify({
        content: 'We should confirm the migration window before committing.',
        tone: 'cautious',
      }),
    ]);
    const proposal: IAgentProposal = {
      agentId: 'test-agent',
      content: 'Clarify the migration timeline',
      urgency: 0.7,
    };

    const response = await agent.generateResponse(snapshot, proposal);

    expect(response).toEqual({
      content: 'We should confirm the migration window before committing.',
      tone: 'cautious',
    });
  });

  it('returns a safe empty result when evaluation fails', async () => {
    class FailingAgent extends BaseAgent {
      id = 'failing-agent';
      role = 'Failing stakeholder';
      responsibilities = ['Exercise fallback path'];

      constructor() {
        super({
          generate: async () => {
            throw new Error('model unavailable');
          },
        });
      }
    }
    const agent = new FailingAgent();
    const blackboard: IBlackboardState = [];

    await expect(agent.evaluate(snapshot, delta, blackboard)).resolves.toEqual({
      proposal: null,
      blackboardEntries: [],
    });
  });
});
