/**
 * Dev C Integration Smoke Test
 *
 * Verifies the full agents + output pipeline WITHOUT needing a real API key.
 * Run: npx vitest run tests/integration/devc-smoke.test.ts
 */

import { describe, expect, it } from "vitest";
import { CTOAgent } from "../../src/agents/cto-agent";
import { ProductAgent } from "../../src/agents/product-agent";
import { FinanceAgent } from "../../src/agents/finance-agent";
import { ResearchAgent } from "../../src/agents/research-agent";
import { AgentRegistry } from "../../src/agents/agent-registry";
import { InterventionScorer } from "../../src/agents/intervention-scorer";
import { ResponseFormatter } from "../../src/output/response-formatter";
import type { IContextSnapshot, ISemanticDelta, IBlackboardState } from "../../src/shared/types";
import type { ILlmClient } from "../../src/agents/interfaces";

// ---------------------------------------------------------------------------
// Mock LLM that returns realistic JSON
// ---------------------------------------------------------------------------

class MockLlm implements ILlmClient {
  private queue: string[];
  constructor(responses: string[]) {
    this.queue = [...responses];
  }
  async generate(_prompt: string): Promise<string> {
    return this.queue.shift() ?? "";
  }
}

function mockEvalResponse(agentId: string) {
  return JSON.stringify({
    proposal: { agentId, content: `Proposal from ${agentId}: adopt the plan`, urgency: 0.6 },
    blackboardEntries: [{ content: `Observation from ${agentId}` }],
  });
}

function mockSpeechResponse() {
  return JSON.stringify({ content: "I recommend proceeding with this approach.", tone: "supportive" });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptySnapshot: IContextSnapshot = {
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
  timestamp: Date.now(),
};

const emptyDelta: ISemanticDelta = {
  units: [{ id: "u1", speakerId: "s1", content: "We need to decide on the database", timestamp: Date.now() }],
  topics: [{ id: "t1", label: "Database choice", confidence: 0.85 }],
  decisions: [],
  assumptions: [],
  risks: [],
};

const emptyBlackboard: IBlackboardState = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dev C integration smoke test", () => {

  // -------------------------------------------------------------------------
  // 1. Individual agents produce valid results
  // -------------------------------------------------------------------------

  it("CTOAgent evaluates and generates response", async () => {
    const agent = new CTOAgent(new MockLlm([mockEvalResponse("cto"), mockSpeechResponse()]));
    const result = await agent.evaluate(emptySnapshot, emptyDelta, emptyBlackboard);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.agentId).toBe("cto");
    expect(result.blackboardEntries).toHaveLength(1);

    const response = await agent.generateResponse(emptySnapshot, result.proposal!);
    expect(response.content).toBeTruthy();
    expect(["neutral", "supportive", "opposed", "cautious"]).toContain(response.tone);
  });

  it("ProductAgent evaluates and generates response", async () => {
    const agent = new ProductAgent(new MockLlm([mockEvalResponse("product"), mockSpeechResponse()]));
    const result = await agent.evaluate(emptySnapshot, emptyDelta, emptyBlackboard);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.agentId).toBe("product");

    const response = await agent.generateResponse(emptySnapshot, result.proposal!);
    expect(response.content).toBeTruthy();
  });

  it("FinanceAgent evaluates and generates response", async () => {
    const agent = new FinanceAgent(new MockLlm([mockEvalResponse("finance"), mockSpeechResponse()]));
    const result = await agent.evaluate(emptySnapshot, emptyDelta, emptyBlackboard);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.agentId).toBe("finance");

    const response = await agent.generateResponse(emptySnapshot, result.proposal!);
    expect(response.content).toBeTruthy();
  });

  it("ResearchAgent evaluates and generates response", async () => {
    const agent = new ResearchAgent(new MockLlm([mockEvalResponse("research"), mockSpeechResponse()]));
    const result = await agent.evaluate(emptySnapshot, emptyDelta, emptyBlackboard);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.agentId).toBe("research");

    const response = await agent.generateResponse(emptySnapshot, result.proposal!);
    expect(response.content).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 2. AgentRegistry manages all 4 agents
  // -------------------------------------------------------------------------

  it("registry holds all agents and provides lookup", () => {
    const registry = new AgentRegistry();
    registry.register(new CTOAgent(new MockLlm([])));
    registry.register(new ProductAgent(new MockLlm([])));
    registry.register(new FinanceAgent(new MockLlm([])));
    registry.register(new ResearchAgent(new MockLlm([])));

    expect(registry.size).toBe(4);
    expect(registry.getAgent("cto")).toBeDefined();
    expect(registry.getAgent("product")).toBeDefined();
    expect(registry.getAgent("finance")).toBeDefined();
    expect(registry.getAgent("research")).toBeDefined();
    expect(registry.getAgent("nonexistent")).toBeUndefined();

    const all = registry.getAll();
    expect(all).toHaveLength(4);
    const ids = all.map((a) => a.id).sort();
    expect(ids).toEqual(["cto", "finance", "product", "research"]);
  });

  // -------------------------------------------------------------------------
  // 3. InterventionScorer scores proposals
  // -------------------------------------------------------------------------

  it("scores a novel high-urgency proposal higher than a duplicate", () => {
    const scorer = new InterventionScorer();
    const proposal = {
      agentId: "cto",
      content: "Critical security vulnerability exposed in production API endpoint",
      urgency: 0.9,
    };
    const highScore = scorer.scoreProposal(proposal, {
      topics: [], decisions: [], assumptions: [],
      risks: [{ id: "r1", description: "data breach", severity: 0.9 }],
      timestamp: Date.now(),
    }, []);

    const lowScore = scorer.scoreProposal(
      { agentId: "cto", content: "Critical security vulnerability exposed in production API endpoint", urgency: 0.9 },
      { topics: [], decisions: [], assumptions: [], risks: [], timestamp: Date.now() },
      [proposal], // duplicate in history
    );

    expect(highScore.novelty).toBe(1);
    expect(lowScore.novelty).toBe(0);
    expect(highScore.score).toBeGreaterThan(lowScore.score);
  });

  // -------------------------------------------------------------------------
  // 4. ResponseFormatter formats proposals
  // -------------------------------------------------------------------------

  it("formats a proposal into markdown and SSML", () => {
    const formatter = new ResponseFormatter();
    const proposal = {
      agentId: "cto",
      content: "Adopt PostgreSQL for the main database",
      urgency: 0.7,
    };
    const formatted = formatter.format(proposal);
    expect(formatted.markdown).toContain("PostgreSQL");
    expect(formatted.ssml).toContain("<speak");
    expect(formatted.ssml).toContain("</speak>");
    expect(formatted.markdown.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 5. Full pipeline: evaluate → score → format
  // -------------------------------------------------------------------------

  it("end-to-end: agent evaluate → score proposal → format for speech", async () => {
    // Step 1: Agent evaluates context
    const agent = new CTOAgent(new MockLlm([mockEvalResponse("cto")]));
    const result = await agent.evaluate(emptySnapshot, emptyDelta, emptyBlackboard);
    expect(result.proposal).not.toBeNull();

    // Step 2: Score the proposal
    const scorer = new InterventionScorer();
    const score = scorer.scoreProposal(result.proposal!, emptySnapshot, []);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);

    // Step 3: Format for speech output
    const formatter = new ResponseFormatter();
    const formatted = formatter.format(result.proposal!);
    expect(formatted.markdown.length).toBeGreaterThan(0);
    expect(formatted.ssml.length).toBeGreaterThan(0);
  });
});
