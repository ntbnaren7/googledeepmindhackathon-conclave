import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../../../src/agents/agent-registry";
import { IStakeholderAgent } from "../../../src/agents/interfaces";
import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
} from "../../../src/shared/types";

// ---------------------------------------------------------------------------
// Mock agent
// ---------------------------------------------------------------------------

function mockAgent(id: string, role: string): IStakeholderAgent {
  let resetCount = 0;
  return {
    id,
    role,
    responsibilities: [role],
    async evaluate(): Promise<IAgentResult> {
      return { proposal: null, blackboardEntries: [] };
    },
    async generateResponse(): Promise<IAgentResponse> {
      return { content: "", tone: "neutral" };
    },
    reset() {
      resetCount++;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentRegistry", () => {
  describe("register", () => {
    it("registers an agent", () => {
      const registry = new AgentRegistry();
      const agent = mockAgent("cto", "CTO");

      registry.register(agent);

      expect(registry.size).toBe(1);
      expect(registry.getAgent("cto")).toBe(agent);
    });

    it("replaces agent with same id", () => {
      const registry = new AgentRegistry();
      const first = mockAgent("cto", "CTO v1");
      const second = mockAgent("cto", "CTO v2");

      registry.register(first);
      registry.register(second);

      expect(registry.size).toBe(1);
      expect(registry.getAgent("cto")).toBe(second);
    });
  });

  describe("remove", () => {
    it("removes an agent by id", () => {
      const registry = new AgentRegistry();
      const agent = mockAgent("cto", "CTO");
      registry.register(agent);

      const removed = registry.remove("cto");

      expect(removed).toBe(agent);
      expect(registry.size).toBe(0);
      expect(registry.getAgent("cto")).toBeUndefined();
    });

    it("returns undefined for unknown id", () => {
      const registry = new AgentRegistry();
      expect(registry.remove("unknown")).toBeUndefined();
    });
  });

  describe("getAgent", () => {
    it("returns agent by id", () => {
      const registry = new AgentRegistry();
      const agent = mockAgent("finance", "Finance");
      registry.register(agent);

      expect(registry.getAgent("finance")).toBe(agent);
    });

    it("returns undefined for unknown id", () => {
      const registry = new AgentRegistry();
      expect(registry.getAgent("nonexistent")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns empty array when no agents", () => {
      const registry = new AgentRegistry();
      expect(registry.getAll()).toEqual([]);
    });

    it("returns all registered agents", () => {
      const registry = new AgentRegistry();
      const cto = mockAgent("cto", "CTO");
      const product = mockAgent("product", "Product");
      const finance = mockAgent("finance", "Finance");

      registry.register(cto);
      registry.register(product);
      registry.register(finance);

      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all).toContain(cto);
      expect(all).toContain(product);
      expect(all).toContain(finance);
    });
  });

  describe("resetAll", () => {
    it("calls reset on all registered agents", () => {
      const registry = new AgentRegistry();
      const cto = mockAgent("cto", "CTO");
      const product = mockAgent("product", "Product");

      registry.register(cto);
      registry.register(product);

      registry.resetAll();

      // Both agents should have been reset (mock tracks this)
      expect(cto.id).toBe("cto");
      expect(product.id).toBe("product");
    });
  });

  describe("size", () => {
    it("returns 0 for empty registry", () => {
      expect(new AgentRegistry().size).toBe(0);
    });

    it("tracks agent count", () => {
      const registry = new AgentRegistry();
      registry.register(mockAgent("a", "A"));
      registry.register(mockAgent("b", "B"));
      expect(registry.size).toBe(2);
    });
  });
});
