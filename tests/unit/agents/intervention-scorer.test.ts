import { describe, expect, it } from "vitest";
import { InterventionScorer } from "../../../src/agents/intervention-scorer";
import {
  IAgentProposal,
  IContextSnapshot,
} from "../../../src/shared/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyContext: IContextSnapshot = {
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
  timestamp: 1000,
};

const contextWithRisks: IContextSnapshot = {
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [
    { id: "r1", description: "Database migration could lose data", severity: 0.9 },
    { id: "r2", description: "API latency spike under load", severity: 0.6 },
  ],
  timestamp: 1000,
};

const contextWithAssumptions: IContextSnapshot = {
  topics: [],
  decisions: [
    { id: "d1", description: "Use PostgreSQL", status: "proposed", timestamp: 1000 },
  ],
  assumptions: [
    { id: "a1", statement: "Traffic will double next quarter", challenged: false },
    { id: "a2", statement: "Team can handle migration", challenged: false },
    { id: "a3", statement: "Budget is approved", challenged: true },
  ],
  risks: [],
  timestamp: 1000,
};

function proposal(content: string, urgency: number): IAgentProposal {
  return { agentId: "test", content, urgency };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InterventionScorer", () => {
  describe("tokenize", () => {
    it("splits text into lowercase tokens", () => {
      expect(InterventionScorer.tokenize("Hello World!")).toEqual(["hello", "world"]);
    });

    it("strips punctuation", () => {
      expect(InterventionScorer.tokenize("cost: $50, ROI: 200%")).toEqual(["cost", "50", "roi", "200"]);
    });

    it("handles empty string", () => {
      expect(InterventionScorer.tokenize("")).toEqual([]);
    });
  });

  describe("jaccardSimilarity", () => {
    it("returns 0 for two empty sets", () => {
      expect(InterventionScorer.jaccardSimilarity(new Set(), new Set())).toBe(0);
    });

    it("returns 1 for identical sets", () => {
      const a = new Set(["a", "b", "c"]);
      expect(InterventionScorer.jaccardSimilarity(a, a)).toBe(1);
    });

    it("returns 0 for disjoint sets", () => {
      const a = new Set(["a", "b"]);
      const b = new Set(["c", "d"]);
      expect(InterventionScorer.jaccardSimilarity(a, b)).toBe(0);
    });

    it("computes partial overlap", () => {
      const a = new Set(["a", "b", "c"]);
      const b = new Set(["b", "c", "d"]);
      expect(InterventionScorer.jaccardSimilarity(a, b)).toBe(0.5);
    });
  });

  describe("keywordHitRate", () => {
    it("returns 0 for empty keywords", () => {
      expect(InterventionScorer.keywordHitRate("any text", [])).toBe(0);
    });

    it("returns 1 when all keywords match", () => {
      expect(InterventionScorer.keywordHitRate("critical urgent blocker", ["critical", "urgent", "blocker"])).toBe(1);
    });

    it("returns partial match", () => {
      expect(InterventionScorer.keywordHitRate("critical and important", ["critical", "urgent", "blocker"])).toBeCloseTo(1 / 3);
    });

    it("returns 0 when no keywords match", () => {
      expect(InterventionScorer.keywordHitRate("hello world", ["critical", "urgent"])).toBe(0);
    });
  });

  describe("clamp", () => {
    it("clamps below min", () => {
      expect(InterventionScorer.clamp(-5, 0, 1)).toBe(0);
    });

    it("clamps above max", () => {
      expect(InterventionScorer.clamp(5, 0, 1)).toBe(1);
    });

    it("returns value within range", () => {
      expect(InterventionScorer.clamp(0.5, 0, 1)).toBe(0.5);
    });
  });

  describe("calculateNovelty", () => {
    const scorer = new InterventionScorer();

    it("returns 1 for empty history", () => {
      expect(scorer.calculateNovelty("anything", [])).toBe(1);
    });

    it("returns 0 for exact duplicate", () => {
      const history = [proposal("We need to scale the database", 0.5)];
      expect(scorer.calculateNovelty("We need to scale the database", history)).toBe(0);
    });

    it("returns high novelty for completely different content", () => {
      const history = [proposal("Marketing budget Q3", 0.3)];
      expect(scorer.calculateNovelty("Database migration timeline", history)).toBeGreaterThan(0.5);
    });
  });

  describe("calculateUrge", () => {
    const scorer = new InterventionScorer();

    it("weights self-reported urgency heavily", () => {
      const high = scorer.calculateUrge({
        proposal: proposal("Do this now", 0.9),
        context: emptyContext,
        history: [],
      });
      const low = scorer.calculateUrge({
        proposal: proposal("Do this now", 0.1),
        context: emptyContext,
        history: [],
      });
      expect(high).toBeGreaterThan(low);
    });

    it("increases with urgency keywords", () => {
      const withKeywords = scorer.calculateUrge({
        proposal: proposal("Critical blocker emergency", 0.5),
        context: emptyContext,
        history: [],
      });
      const without = scorer.calculateUrge({
        proposal: proposal("Nice to have feature", 0.5),
        context: emptyContext,
        history: [],
      });
      expect(withKeywords).toBeGreaterThan(without);
    });

    it("increases with risk pressure", () => {
      const withRisks = scorer.calculateUrge({
        proposal: proposal("Consider the options", 0.5),
        context: contextWithRisks,
        history: [],
      });
      const without = scorer.calculateUrge({
        proposal: proposal("Consider the options", 0.5),
        context: emptyContext,
        history: [],
      });
      expect(withRisks).toBeGreaterThan(without);
    });
  });

  describe("calculateConfidence", () => {
    const scorer = new InterventionScorer();

    it("increases with evidence keywords", () => {
      const withEvidence = scorer.calculateConfidence(
        proposal("Data shows proven metrics from benchmark analysis", 0.5),
        emptyContext,
      );
      const without = scorer.calculateConfidence(
        proposal("I think maybe we should try", 0.5),
        emptyContext,
      );
      expect(withEvidence).toBeGreaterThan(without);
    });

    it("increases with longer content", () => {
      const short = scorer.calculateConfidence(proposal("Yes", 0.5), emptyContext);
      const long = scorer.calculateConfidence(
        proposal("This is a detailed analysis with multiple supporting points and evidence", 0.5),
        emptyContext,
      );
      expect(long).toBeGreaterThan(short);
    });

    it("increases when risks are present", () => {
      const withRisks = scorer.calculateConfidence(proposal("test", 0.5), contextWithRisks);
      const without = scorer.calculateConfidence(proposal("test", 0.5), emptyContext);
      expect(withRisks).toBeGreaterThan(without);
    });
  });

  describe("calculateUrgency", () => {
    const scorer = new InterventionScorer();

    it("increases with unresolved assumptions", () => {
      const withAssumptions = scorer.calculateUrgency(
        proposal("test", 0.5),
        contextWithAssumptions,
      );
      const without = scorer.calculateUrgency(proposal("test", 0.5), emptyContext);
      expect(withAssumptions).toBeGreaterThan(without);
    });

    it("increases with urgency keywords", () => {
      const withKeywords = scorer.calculateUrgency(
        proposal("Critical risk blocking everything", 0.5),
        emptyContext,
      );
      const without = scorer.calculateUrgency(proposal("Nice idea", 0.5), emptyContext);
      expect(withKeywords).toBeGreaterThan(without);
    });
  });

  describe("scoreProposal", () => {
    const scorer = new InterventionScorer();

    it("returns all fields in [0, 1]", () => {
      const result = scorer.scoreProposal(
        proposal("Critical database risk needs immediate attention", 0.8),
        contextWithRisks,
        [],
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.urgency).toBeGreaterThanOrEqual(0);
      expect(result.urgency).toBeLessThanOrEqual(1);
      expect(result.novelty).toBeGreaterThanOrEqual(0);
      expect(result.novelty).toBeLessThanOrEqual(1);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it("rejects duplicate proposals", () => {
      const history = [proposal("Database migration is risky", 0.5)];
      const result = scorer.scoreProposal(
        proposal("Database migration is risky", 0.5),
        emptyContext,
        history,
      );
      expect(result.novelty).toBe(0);
      expect(result.shouldInterrupt).toBe(false);
    });

    it("allows novel high-urgency proposals", () => {
      const result = scorer.scoreProposal(
        proposal("Critical security vulnerability exposed in production API endpoint", 0.9),
        contextWithRisks,
        [],
      );
      expect(result.novelty).toBe(1);
      expect(result.shouldInterrupt).toBe(true);
    });
  });
});
