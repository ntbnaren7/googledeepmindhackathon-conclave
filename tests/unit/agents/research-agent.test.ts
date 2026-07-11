import { describe, expect, it } from "vitest";
import { ResearchAgent } from "../../../src/agents/research-agent";
import {
  createMockLlm,
  emptySnapshot,
  deltaWithContent,
  emptyBlackboard,
  validProposalResponse,
  nullProposalResponse,
  validSpeechResponse,
} from "./test-utils";

describe("ResearchAgent", () => {
  describe("identity", () => {
    it("has correct id", () => {
      expect(new ResearchAgent(createMockLlm()).id).toBe("research");
    });

    it("has correct role", () => {
      expect(new ResearchAgent(createMockLlm()).role).toBe("research");
    });

    it("has correct responsibilities", () => {
      const agent = new ResearchAgent(createMockLlm());
      expect(agent.responsibilities).toContain("Missing Evidence");
      expect(agent.responsibilities).toContain("Unsupported Assumptions");
      expect(agent.responsibilities).toContain("Validation");
    });
  });

  describe("evaluate", () => {
    it("returns proposal when LLM produces one", async () => {
      const llm = createMockLlm([validProposalResponse("research")]);
      const agent = new ResearchAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.agentId).toBe("research");
    });

    it("returns null when LLM returns null", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new ResearchAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });

    it("sends research-focused prompt", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new ResearchAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      const prompt = llm.prompts[0];
      expect(prompt).toContain("Research lead");
      expect(prompt).toContain("Missing Evidence");
      expect(prompt).toContain("Validation");
    });

    it("handles LLM errors gracefully", async () => {
      const llm = createMockLlm([]);
      llm.generate = async () => { throw new Error("fail"); };
      const agent = new ResearchAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });
  });

  describe("generateResponse", () => {
    it("returns spoken response", async () => {
      const llm = createMockLlm([validSpeechResponse()]);
      const agent = new ResearchAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Scale the database",
        urgency: 0.6,
      });

      expect(response.content).toBe("This is a valid spoken response");
      expect(response.tone).toBe("neutral");
    });

    it("returns fallback for empty LLM output", async () => {
      const llm = createMockLlm([""]);
      const agent = new ResearchAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Scale database",
        urgency: 0.5,
      });

      expect(response.content).toContain("research perspective");
      expect(response.tone).toBe("cautious");
    });
  });
});
