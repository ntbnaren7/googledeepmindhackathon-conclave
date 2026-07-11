import { describe, expect, it } from "vitest";
import { FinanceAgent } from "@agents/finance-agent";
import {
  createMockLlm,
  emptySnapshot,
  deltaWithContent,
  emptyBlackboard,
  validProposalResponse,
  nullProposalResponse,
  validSpeechResponse,
} from "./test-utils";

describe("FinanceAgent", () => {
  describe("identity", () => {
    it("has correct id", () => {
      expect(new FinanceAgent(createMockLlm()).id).toBe("finance");
    });

    it("has correct role", () => {
      expect(new FinanceAgent(createMockLlm()).role).toBe("finance");
    });

    it("has correct responsibilities", () => {
      const agent = new FinanceAgent(createMockLlm());
      expect(agent.responsibilities).toContain("Cost");
      expect(agent.responsibilities).toContain("ROI");
      expect(agent.responsibilities).toContain("Financial Risk");
    });
  });

  describe("evaluate", () => {
    it("returns proposal when LLM produces one", async () => {
      const llm = createMockLlm([validProposalResponse("finance")]);
      const agent = new FinanceAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.agentId).toBe("finance");
    });

    it("returns null when LLM returns null", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new FinanceAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });

    it("sends finance-focused prompt", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new FinanceAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      const prompt = llm.prompts[0];
      expect(prompt).toContain("Finance lead");
      expect(prompt).toContain("Cost");
      expect(prompt).toContain("ROI");
    });

    it("handles LLM errors gracefully", async () => {
      const llm = createMockLlm([]);
      llm.generate = async () => { throw new Error("fail"); };
      const agent = new FinanceAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });
  });

  describe("generateResponse", () => {
    it("returns spoken response", async () => {
      const llm = createMockLlm([validSpeechResponse()]);
      const agent = new FinanceAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Build new infrastructure",
        urgency: 0.6,
      });

      expect(response.content).toBe("This is a valid spoken response");
      expect(response.tone).toBe("neutral");
    });

    it("returns fallback for empty LLM output", async () => {
      const llm = createMockLlm([""]);
      const agent = new FinanceAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Build infrastructure",
        urgency: 0.5,
      });

      expect(response.content).toContain("financial perspective");
      expect(response.tone).toBe("cautious");
    });
  });
});
