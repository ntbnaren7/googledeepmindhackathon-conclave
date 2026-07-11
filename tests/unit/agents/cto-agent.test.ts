import { describe, expect, it } from "vitest";
import { CTOAgent } from "../../../src/agents/cto-agent";
import {
  createMockLlm,
  emptySnapshot,
  emptyDelta,
  emptyBlackboard,
  snapshotWithTopics,
  deltaWithContent,
  blackboardWithEntries,
  validProposalResponse,
  nullProposalResponse,
  validSpeechResponse,
} from "./test-utils";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CTOAgent", () => {
  describe("identity", () => {
    it("has correct id", () => {
      const agent = new CTOAgent(createMockLlm());
      expect(agent.id).toBe("cto");
    });

    it("has correct role", () => {
      const agent = new CTOAgent(createMockLlm());
      expect(agent.role).toBe("cto");
    });

    it("has correct responsibilities", () => {
      const agent = new CTOAgent(createMockLlm());
      expect(agent.responsibilities).toContain("Architecture");
      expect(agent.responsibilities).toContain("Security");
      expect(agent.responsibilities).toContain("Scalability");
    });
  });

  describe("evaluate", () => {
    it("returns proposal when LLM produces one", async () => {
      const llm = createMockLlm([validProposalResponse("cto")]);
      const agent = new CTOAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.agentId).toBe("cto");
      expect(result.proposal!.urgency).toBeGreaterThanOrEqual(0);
      expect(result.proposal!.urgency).toBeLessThanOrEqual(1);
    });

    it("returns null proposal when LLM returns null", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new CTOAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).toBeNull();
    });

    it("sends structured delta to LLM (not raw transcript)", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new CTOAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      const prompt = llm.prompts[0];
      expect(prompt).toContain("CTO");
      expect(prompt).toContain("Architecture");
      expect(prompt).toContain("Database choice");
      expect(prompt).toContain("Migrate to PostgreSQL");
    });

    it("handles LLM errors gracefully", async () => {
      const llm = createMockLlm([]);
      llm.generate = async () => { throw new Error("LLM down"); };
      const agent = new CTOAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).toBeNull();
      expect(result.blackboardEntries).toEqual([]);
    });

    it("includes blackboard in prompt", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new CTOAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, blackboardWithEntries);

      const prompt = llm.prompts[0];
      expect(prompt).toContain("Architecture review needed");
    });
  });

  describe("generateResponse", () => {
    it("returns spoken response from LLM", async () => {
      const llm = createMockLlm([validSpeechResponse()]);
      const agent = new CTOAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "product",
        content: "We should ship MVP first",
        urgency: 0.5,
      });

      expect(response.content).toBe("This is a valid spoken response");
      expect(response.tone).toBe("neutral");
    });

    it("returns fallback when LLM returns empty", async () => {
      const llm = createMockLlm([""]);
      const agent = new CTOAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "product",
        content: "Ship MVP",
        urgency: 0.5,
      });

      expect(response.content).toContain("technical standpoint");
      expect(response.tone).toBe("cautious");
    });
  });

  describe("reset", () => {
    it("clears proposal history", async () => {
      const llm = createMockLlm([
        validProposalResponse("cto"),
        validProposalResponse("cto"),
      ]);
      const agent = new CTOAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      agent.reset();

      // After reset, same proposal should not be filtered as duplicate
      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).not.toBeNull();
    });
  });
});
