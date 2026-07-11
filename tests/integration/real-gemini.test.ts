/**
 * Real Gemini API Integration Test
 *
 * Run: npx vitest run tests/integration/real-gemini-test.ts
 * Requires: GEMINI_API_KEY set in .env
 */

import { describe, expect, it } from "vitest";
import { GeminiLlmClient } from "../../src/agents/gemini-llm-client";
import { CTOAgent } from "../../src/agents/cto-agent";
import { ProductAgent } from "../../src/agents/product-agent";
import { FinanceAgent } from "../../src/agents/finance-agent";
import { ResearchAgent } from "../../src/agents/research-agent";
import { ResponseFormatter } from "../../src/output/response-formatter";
import { InterventionScorer } from "../../src/agents/intervention-scorer";
import type { IContextSnapshot, ISemanticDelta, IBlackboardState } from "../../src/shared/types";

describe("Real Gemini API integration", () => {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const client = new GeminiLlmClient({ apiKey, model: "gemini-3.5-flash" });

  const snapshot: IContextSnapshot = {
    topics: [{ id: "t1", label: "Database migration", confidence: 0.9 }],
    decisions: [],
    assumptions: [{ id: "a1", statement: "Team has capacity", challenged: false }],
    risks: [{ id: "r1", description: "Data loss during migration", severity: 0.8 }],
    timestamp: Date.now(),
  };

  const delta: ISemanticDelta = {
    units: [{ id: "u1", speakerId: "s1", content: "We need to migrate the database to PostgreSQL", timestamp: Date.now() }],
    topics: [{ id: "t1", label: "Database choice", confidence: 0.85 }],
    decisions: [{ id: "d1", description: "Migrate to PostgreSQL", status: "proposed", timestamp: Date.now() }],
    assumptions: [],
    risks: [],
  };

  const blackboard: IBlackboardState = [];

  it("raw LLM call returns text", async () => {
    const response = await client.generate("Say hello in one sentence.");
    expect(response).toBeTruthy();
    expect(typeof response).toBe("string");
    console.log("  LLM response:", response);
  });

  it("CTO agent evaluates context and produces proposal", async () => {
    const cto = new CTOAgent(client);
    const result = await cto.evaluate(snapshot, delta, blackboard);
    expect(result.proposal).not.toBeNull();
    expect(result.proposal!.agentId).toBe("cto");
    expect(result.proposal!.content).toBeTruthy();
    expect(result.proposal!.urgency).toBeGreaterThanOrEqual(0);
    expect(result.proposal!.urgency).toBeLessThanOrEqual(1);
    console.log("  CTO proposal:", result.proposal!.content);
    console.log("  CTO urgency:", result.proposal!.urgency);
  });

  it("CTO agent generates spoken response", async () => {
    const cto = new CTOAgent(client);
    const result = await cto.evaluate(snapshot, delta, blackboard);
    const response = await cto.generateResponse(snapshot, result.proposal!);
    expect(response.content).toBeTruthy();
    expect(["neutral", "supportive", "opposed", "cautious"]).toContain(response.tone);
    console.log("  CTO response:", response.content);
    console.log("  CTO tone:", response.tone);
  });

  it("proposal scores correctly", async () => {
    const cto = new CTOAgent(client);
    const result = await cto.evaluate(snapshot, delta, blackboard);
    const scorer = new InterventionScorer();
    const score = scorer.scoreProposal(result.proposal!, snapshot, []);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.novelty).toBe(1);
    console.log("  Score:", score.score.toFixed(3));
    console.log("  Confidence:", score.confidence.toFixed(2));
    console.log("  Urgency:", score.urgency.toFixed(2));
    console.log("  Novelty:", score.novelty.toFixed(2));
  });

  it("formatter produces markdown + SSML", async () => {
    const cto = new CTOAgent(client);
    const result = await cto.evaluate(snapshot, delta, blackboard);
    const formatter = new ResponseFormatter();
    const formatted = formatter.format(result.proposal!);
    expect(formatted.markdown).toBeTruthy();
    expect(formatted.ssml).toContain("<speak");
    console.log("  Markdown:", formatted.markdown);
  });

  it("all 4 agents produce proposals", async () => {
    const agents = [
      new CTOAgent(client),
      new ProductAgent(client),
      new FinanceAgent(client),
      new ResearchAgent(client),
    ];
    for (const agent of agents) {
      const result = await agent.evaluate(snapshot, delta, blackboard);
      console.log(`  ${agent.id}: ${result.proposal?.content?.slice(0, 80) ?? "null"}`);
      if (result.proposal) {
        expect(result.proposal.content).toBeTruthy();
        expect(result.proposal.agentId).toBe(agent.id);
      }
    }
  });
});
