import { describe, expect, it } from "vitest";
import { ProductAgent } from "../../../src/agents/product-agent";
import {
  createMockLlm,
  emptySnapshot,
  deltaWithContent,
  emptyBlackboard,
  validProposalResponse,
  nullProposalResponse,
  validSpeechResponse,
} from "./test-utils";

describe("ProductAgent", () => {
  describe("identity", () => {
    it("has correct id", () => {
      expect(new ProductAgent(createMockLlm()).id).toBe("product");
    });

    it("has correct role", () => {
      expect(new ProductAgent(createMockLlm()).role).toBe("product");
    });

    it("has correct responsibilities", () => {
      const agent = new ProductAgent(createMockLlm());
      expect(agent.responsibilities).toContain("User Value");
      expect(agent.responsibilities).toContain("MVP Scope");
      expect(agent.responsibilities).toContain("Roadmap");
    });
  });

  describe("evaluate", () => {
    it("returns proposal when LLM produces one", async () => {
      const llm = createMockLlm([validProposalResponse("product")]);
      const agent = new ProductAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.agentId).toBe("product");
    });

    it("returns null when LLM returns null", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new ProductAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });

    it("sends product-focused prompt", async () => {
      const llm = createMockLlm([nullProposalResponse()]);
      const agent = new ProductAgent(llm);

      await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);

      const prompt = llm.prompts[0];
      expect(prompt).toContain("Product lead");
      expect(prompt).toContain("User Value");
      expect(prompt).toContain("MVP Scope");
    });

    it("handles LLM errors gracefully", async () => {
      const llm = createMockLlm([]);
      llm.generate = async () => { throw new Error("fail"); };
      const agent = new ProductAgent(llm);

      const result = await agent.evaluate(emptySnapshot, deltaWithContent, emptyBlackboard);
      expect(result.proposal).toBeNull();
    });
  });

  describe("generateResponse", () => {
    it("returns spoken response", async () => {
      const llm = createMockLlm([validSpeechResponse()]);
      const agent = new ProductAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Delay launch for security audit",
        urgency: 0.7,
      });

      expect(response.content).toBe("This is a valid spoken response");
      expect(response.tone).toBe("neutral");
    });

    it("returns fallback for empty LLM output", async () => {
      const llm = createMockLlm([""]);
      const agent = new ProductAgent(llm);

      const response = await agent.generateResponse(emptySnapshot, {
        agentId: "cto",
        content: "Delay launch",
        urgency: 0.5,
      });

      expect(response.content).toContain("product perspective");
      expect(response.tone).toBe("cautious");
    });
  });
});
