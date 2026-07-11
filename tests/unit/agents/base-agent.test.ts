import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseAgent } from "@agents/base-agent";
import {
  IBlackboardState,
  IContextSnapshot,
  IAgentProposal,
  ISemanticDelta,
} from "@shared/types";

// ---------------------------------------------------------------------------
// Test agent — minimal concrete implementation
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent {
  readonly id = "test-agent";
  readonly role = "Test stakeholder";
  readonly responsibilities = ["Review meeting context"];
  readonly prompts: string[] = [];

  constructor(outputs: string[]) {
    const collected: string[] = [];
    super({
      generate: async (prompt: string) => {
        collected.push(prompt);
        return outputs.shift() ?? "";
      },
    });
    // Bind the external reference so tests can inspect prompts
    Object.defineProperty(this, "prompts", { get: () => collected });
  }
}

// ---------------------------------------------------------------------------
// Relevance-filtered agent
// ---------------------------------------------------------------------------

class SelectiveAgent extends BaseAgent {
  readonly id = "selective";
  readonly role = "Selective";
  readonly responsibilities = ["Filter test"];

  constructor(outputs: string[]) {
    super({
      generate: async () => outputs.shift() ?? "",
    });
  }

  protected override isRelevantDelta(delta: ISemanticDelta): boolean {
    return delta.topics.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const deltaWithTopics: ISemanticDelta = {
  units: [],
  topics: [{ id: "t1", label: "Architecture", confidence: 0.9 }],
  decisions: [],
  assumptions: [],
  risks: [],
};

const blackboard: IBlackboardState = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseAgent", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // evaluate
  // =========================================================================

  describe("evaluate", () => {
    it("evaluates model output into a proposal and blackboard entries", async () => {
      const agent = new TestAgent([
        JSON.stringify({
          proposal: {
            agentId: "model-agent",
            content: "Clarify the database migration timeline",
            urgency: 0.8,
          },
          blackboardEntries: [{ content: "Timeline risk noted" }],
        }),
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).toEqual({
        agentId: "test-agent",
        content: "Clarify the database migration timeline",
        urgency: 0.8,
      });
      expect(result.blackboardEntries).toEqual([
        {
          agentId: "test-agent",
          content: "Timeline risk noted",
          timestamp: expect.any(Number),
        },
      ]);
    });

    it("returns null proposal when LLM returns null", async () => {
      const agent = new TestAgent([
        JSON.stringify({ proposal: null, blackboardEntries: [] }),
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).toBeNull();
      expect(result.blackboardEntries).toEqual([]);
    });

    it("returns null proposal when LLM returns empty", async () => {
      const agent = new TestAgent([""]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).toBeNull();
    });

    it("handles malformed JSON gracefully", async () => {
      const agent = new TestAgent(["not valid json at all"]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).toBeNull();
      expect(result.blackboardEntries).toEqual([]);
    });

    it("extracts JSON from markdown code fences", async () => {
      const agent = new TestAgent([
        "```json\n" +
          JSON.stringify({
            proposal: { content: "Fenced proposal", urgency: 0.5 },
            blackboardEntries: [],
          }) +
          "\n```",
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.content).toBe("Fenced proposal");
      expect(result.proposal!.agentId).toBe("test-agent");
    });

    it("extracts JSON surrounded by prose", async () => {
      const agent = new TestAgent([
        'Here is my analysis:\n' +
          JSON.stringify({
            proposal: { content: "Embedded proposal", urgency: 0.6 },
            blackboardEntries: [],
          }) +
          '\nEnd of analysis.',
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.content).toBe("Embedded proposal");
    });

    it("forces agent ID on proposal regardless of LLM output", async () => {
      const agent = new TestAgent([
        JSON.stringify({
          proposal: { agentId: "wrong-id", content: "Test", urgency: 0.5 },
          blackboardEntries: [],
        }),
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal!.agentId).toBe("test-agent");
    });

    it("suppresses duplicate proposals", async () => {
      const agent = new TestAgent([
        JSON.stringify({
          proposal: { content: "Same proposal", urgency: 0.5 },
          blackboardEntries: [],
        }),
        JSON.stringify({
          proposal: { content: "Same proposal", urgency: 0.5 },
          blackboardEntries: [],
        }),
      ]);

      const first = await agent.evaluate(snapshot, delta, blackboard);
      const second = await agent.evaluate(snapshot, delta, blackboard);

      expect(first.proposal).not.toBeNull();
      expect(second.proposal).toBeNull();
    });

    it("allows novel proposals after reset", async () => {
      const agent = new TestAgent([
        JSON.stringify({
          proposal: { content: "Same proposal", urgency: 0.5 },
          blackboardEntries: [],
        }),
        JSON.stringify({
          proposal: { content: "Same proposal", urgency: 0.5 },
          blackboardEntries: [],
        }),
      ]);

      await agent.evaluate(snapshot, delta, blackboard);
      agent.reset();
      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).not.toBeNull();
    });
  });

  // =========================================================================
  // Relevance filtering
  // =========================================================================

  describe("isRelevantDelta", () => {
    it("skips evaluation when delta is irrelevant", async () => {
      const agent = new SelectiveAgent([
        JSON.stringify({ proposal: { content: "Should not happen", urgency: 0.5 }, blackboardEntries: [] }),
      ]);

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result.proposal).toBeNull();
    });

    it("proceeds when delta is relevant", async () => {
      const agent = new SelectiveAgent([
        JSON.stringify({ proposal: { content: "Relevant proposal", urgency: 0.5 }, blackboardEntries: [] }),
      ]);

      const result = await agent.evaluate(snapshot, deltaWithTopics, blackboard);

      expect(result.proposal).not.toBeNull();
    });
  });

  // =========================================================================
  // generateResponse
  // =========================================================================

  describe("generateResponse", () => {
    it("generates a spoken response from model output", async () => {
      const agent = new TestAgent([
        JSON.stringify({
          content: "We should confirm the migration window before committing.",
          tone: "cautious",
        }),
      ]);
      const proposal: IAgentProposal = {
        agentId: "test-agent",
        content: "Clarify the migration timeline",
        urgency: 0.7,
      };

      const response = await agent.generateResponse(snapshot, proposal);

      expect(response).toEqual({
        content: "We should confirm the migration window before committing.",
        tone: "cautious",
      });
    });

    it("returns empty content when LLM returns empty", async () => {
      const agent = new TestAgent([""]);

      const response = await agent.generateResponse(snapshot, {
        agentId: "test",
        content: "Test",
        urgency: 0.5,
      });

      expect(response.content).toBe("");
      expect(response.tone).toBe("neutral");
    });

    it("returns safe fallback on LLM error", async () => {
      const agent = new TestAgent([]);
      // Override the private readonly llmClient via defineProperty
      Object.defineProperty(agent, "llmClient", {
        value: { generate: async () => { throw new Error("fail"); } },
        writable: false,
        configurable: true,
      });

      const response = await agent.generateResponse(snapshot, {
        agentId: "test",
        content: "Test",
        urgency: 0.5,
      });

      expect(response.content).toBe("");
      expect(response.tone).toBe("neutral");
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("error handling", () => {
    it("returns safe empty result when evaluation fails", async () => {
      class FailingAgent extends BaseAgent {
        readonly id = "failing-agent";
        readonly role = "Failing stakeholder";
        readonly responsibilities = ["Exercise fallback path"];

        constructor() {
          super({
            generate: async () => {
              throw new Error("model unavailable");
            },
          });
        }
      }
      const agent = new FailingAgent();

      const result = await agent.evaluate(snapshot, delta, blackboard);

      expect(result).toEqual({ proposal: null, blackboardEntries: [] });
    });
  });

  // =========================================================================
  // Prompt formatting
  // =========================================================================

  describe("prompt formatting", () => {
    it("includes role and responsibilities in evaluation prompt", async () => {
      const agent = new TestAgent([""]);

      await agent.evaluate(snapshot, delta, blackboard);

      const prompt = agent.prompts[0];
      expect(prompt).toContain("Test stakeholder");
      expect(prompt).toContain("Review meeting context");
    });

    it("formats snapshot topics in prompt", async () => {
      const agent = new TestAgent([""]);
      const snap: IContextSnapshot = {
        topics: [{ id: "t1", label: "Migration", confidence: 0.9 }],
        decisions: [],
        assumptions: [],
        risks: [],
        timestamp: 1000,
      };

      await agent.evaluate(snap, delta, blackboard);

      expect(agent.prompts[0]).toContain("Migration");
    });

    it("formats delta decisions in prompt", async () => {
      const agent = new TestAgent([""]);
      const d: ISemanticDelta = {
        units: [],
        topics: [],
        decisions: [{ id: "d1", description: "Use React", status: "approved", timestamp: 1000 }],
        assumptions: [],
        risks: [],
      };

      await agent.evaluate(snapshot, d, blackboard);

      expect(agent.prompts[0]).toContain("Use React");
    });

    it("formats blackboard entries in prompt", async () => {
      const agent = new TestAgent([""]);
      const bb: IBlackboardState = [
        { agentId: "cto", content: "Architecture review needed", timestamp: 1000 },
      ];

      await agent.evaluate(snapshot, delta, bb);

      expect(agent.prompts[0]).toContain("Architecture review needed");
    });

    it("shows empty state messages when context is empty", async () => {
      const agent = new TestAgent([""]);

      await agent.evaluate(snapshot, delta, blackboard);

      const prompt = agent.prompts[0];
      expect(prompt).toContain("(No context available)");
      expect(prompt).toContain("(No changes)");
      expect(prompt).toContain("(Empty)");
    });
  });
});
