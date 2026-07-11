import {
  IAgentProposal,
  AgentContextSnapshot,
} from "@shared/types";
import { clamp } from "@shared/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input bundle for `calculateUrge`. */
export interface IUrgeParams {
  proposal: IAgentProposal;
  context: AgentContextSnapshot;
  history: readonly IAgentProposal[];
}

/**
 * Full scoring breakdown returned by `scoreProposal`.
 *
 * The interrupt decision (shouldInterrupt) is NOT computed here.
 * That is a Kernel/Arbitrator concern that depends on cooldown state,
 * speaker flow, and attention budget — none of which the scorer has.
 */
export interface ScoringResult {
  /** How confident the agent should be in this proposal (0–1). */
  confidence: number;
  /** How time-sensitive the proposal is (0–1). */
  urgency: number;
  /** How unique this proposal is vs. recent history (0–1). */
  novelty: number;
  /** Weighted composite score (0–1). */
  score: number;
}

// ---------------------------------------------------------------------------
// Keyword dictionaries (deterministic, no LLM)
// ---------------------------------------------------------------------------

/** Words that indicate the proposal is time-sensitive or critical. */
const URGENCY_KEYWORDS: readonly string[] = [
  "critical",
  "urgent",
  "immediately",
  "asap",
  "blocker",
  "blocking",
  "risk",
  "fail",
  "failure",
  "deadline",
  "emergency",
  "severe",
  "high priority",
  "cannot wait",
  "time-sensitive",
  "now",
  "today",
];

/** Words that suggest the proposal is backed by evidence or analysis. */
const CONFIDENCE_KEYWORDS: readonly string[] = [
  "data",
  "metrics",
  "evidence",
  "proven",
  "measured",
  "benchmark",
  "tested",
  "validated",
  "analysis",
  "research",
  "cost",
  "roi",
  "performance",
  "scalability",
];

// ---------------------------------------------------------------------------
// InterventionScorer
// ---------------------------------------------------------------------------

/**
 * Pure, deterministic scorer for agent proposals.
 *
 * Every public method is side-effect-free and deterministic given the same
 * inputs — making the class straightforward to unit-test.
 *
 * Scoring pipeline:
 *   1. **Confidence** — how well-supported is the proposal?
 *      (content length, evidence keywords, risk alignment)
 *   2. **Urgency** — how time-sensitive is it?
 *      (LLM-reported urgency, urgency keywords, risk severity in context)
 *   3. **Novelty** — how different is it from recent proposals?
 *      (word-level Jaccard distance)
 *   4. **Composite** — weighted sum of the three scores.
 *   5. **Decision** — composite must exceed the global urgency minimum
 *      and novelty must exceed the deduplication threshold.
 */
export class InterventionScorer {
  // =========================================================================
  // Public scoring methods
  // =========================================================================

  /**
   * Compute how novel a proposed text is compared to recent history.
   *
   * Returns a value in [0, 1]:
   *   - 1  = completely unique (no overlap with any history entry)
   *   - 0  = exact duplicate of a history entry
   *
   * Used by `BaseAgent.filterByNovelty` to suppress redundant proposals.
   */
  calculateNovelty(
    proposed: string,
    history: readonly IAgentProposal[],
  ): number {
    if (history.length === 0) return 1;

    const proposedTokens = new Set(InterventionScorer.tokenize(proposed));

    // If the proposal is empty or has no tokens, treat as fully novel
    if (proposedTokens.size === 0) return 1;

    // Compute similarity against each historical proposal and take the max.
    // A new proposal is only "novel" if it differs from ALL past proposals.
    let maxSimilarity = 0;
    for (const entry of history) {
      const historyTokens = new Set(InterventionScorer.tokenize(entry.content));
      const sim = InterventionScorer.jaccardSimilarity(proposedTokens, historyTokens);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    // Novelty = 1 − maxSimilarity
    return clamp(1 - maxSimilarity, 0, 1);
  }

  /**
   * Compute a composite urgency score for a proposal in its context.
   *
   * Combines three signals:
   *   - The proposal's own self-reported urgency (0–1)
   *   - Keyword density of urgency-related terms in the content
   *   - Severity of unresolved risks in the current context
   *
   * Returns a value in [0, 1].
   */
  calculateUrge(params: IUrgeParams): number {
    const { proposal, context } = params;

    // Signal 1 — the LLM's own urgency rating (weight: 50%)
    const selfUrgency = clamp(proposal.urgency, 0, 1);

    // Signal 2 — keyword density (weight: 30%)
    const keywordUrgency = InterventionScorer.keywordHitRate(
      proposal.content,
      URGENCY_KEYWORDS,
    );

    // Signal 3 — contextual risk pressure (weight: 20%)
    const riskPressure = InterventionScorer.riskPressure(context);

    return selfUrgency * 0.5 + keywordUrgency * 0.3 + riskPressure * 0.2;
  }

  /**
   * Compute how confident an agent should be in this proposal.
   *
   * Signals:
   *   - Content length (longer = more detailed, with diminishing returns)
   *   - Presence of evidence/analysis keywords
   *   - Alignment with active risks in the context
   *
   * Returns a value in [0, 1].
   */
  calculateConfidence(
    proposal: IAgentProposal,
    context: AgentContextSnapshot,
  ): number {
    // Signal 1 — content length (weight: 40%)
    // Sigmoid-like curve: short content → low, long → high, capped at ~200 chars
    const wordCount = InterventionScorer.tokenize(proposal.content).length;
    const lengthScore = clamp(wordCount / 40, 0, 1);

    // Signal 2 — evidence keyword density (weight: 35%)
    const evidenceScore = InterventionScorer.keywordHitRate(
      proposal.content,
      CONFIDENCE_KEYWORDS,
    );

    // Signal 3 — contextual relevance (weight: 25%)
    // If there are active risks, a risk-aware proposal is more credible
    const relevanceScore = context.risks.length > 0 ? 0.5 : 0.2;

    return lengthScore * 0.4 + evidenceScore * 0.35 + relevanceScore * 0.25;
  }

  /**
   * Compute time-sensitivity urgency independent of the LLM's rating.
   *
   * This is a context-aware urgency signal that looks at:
   *   - Urgency keywords in the proposal text
   *   - Number of unresolved (un-challenged) assumptions
   *   - Number of active high-severity risks
   *   - Number of decisions still in "proposed" status
   *
   * Returns a value in [0, 1].
   */
  calculateUrgency(
    proposal: IAgentProposal,
    context: AgentContextSnapshot,
  ): number {
    // Signal 1 — keyword density (weight: 35%)
    const keywordScore = InterventionScorer.keywordHitRate(
      proposal.content,
      URGENCY_KEYWORDS,
    );

    // Signal 2 — unresolved assumptions pressure (weight: 25%)
    const unresolvedAssumptions = context.assumptions.filter(
      (a) => !a.challenged,
    ).length;
    const assumptionPressure = clamp(
      unresolvedAssumptions / 5,
      0,
      1,
    );

    // Signal 3 — risk severity pressure (weight: 25%)
    const riskPressure = InterventionScorer.riskPressure(context);

    // Signal 4 — pending decisions (weight: 15%)
    const pendingDecisions = context.decisions.filter(
      (d) => d.status === "proposed",
    ).length;
    const decisionPressure = clamp(
      pendingDecisions / 3,
      0,
      1,
    );

    return (
      keywordScore * 0.35 +
      assumptionPressure * 0.25 +
      riskPressure * 0.25 +
      decisionPressure * 0.15
    );
  }

  /**
   * Full scoring pipeline — produces a ScoringResult for a proposal.
   *
   * This is the main entry point for scoring a proposal against context
   * and history. It computes all individual scores and the composite.
   *
   * The interrupt decision is made by the Kernel/Arbitrator layer,
   * which has access to cooldown state, speaker flow, and attention budget.
   */
  scoreProposal(
    proposal: IAgentProposal,
    context: AgentContextSnapshot,
    history: readonly IAgentProposal[],
  ): ScoringResult {
    const confidence = this.calculateConfidence(proposal, context);
    const urgency = this.calculateUrge({
      proposal,
      context,
      history,
    });
    const novelty = this.calculateNovelty(proposal.content, history);

    // Weighted composite: urgency is weighted highest because the system's
    // core question is "should we interrupt now?", followed by confidence
    // ("is the agent sure enough?"), then novelty ("is this new?").
    const score = urgency * 0.45 + confidence * 0.3 + novelty * 0.25;

    return { confidence, urgency, novelty, score };
  }

  // =========================================================================
  // Static helpers — public for unit testing
  // =========================================================================

  /**
   * Split text into lowercase alphanumeric tokens.
   * Strips punctuation and collapses whitespace.
   */
  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Jaccard similarity between two token sets.
   *   |A ∩ B| / |A ∪ B|
   *
   * Returns 0 if both sets are empty.
   */
  static jaccardSimilarity(
    a: ReadonlySet<string>,
    b: ReadonlySet<string>,
  ): number {
    if (a.size === 0 && b.size === 0) return 0;

    let intersectionSize = 0;
    for (const token of a) {
      if (b.has(token)) intersectionSize++;
    }

    const unionSize = a.size + b.size - intersectionSize;
    return unionSize === 0 ? 0 : intersectionSize / unionSize;
  }

  /**
   * What fraction of the given keywords appear in the text?
   * Returns a value in [0, 1].
   */
  static keywordHitRate(
    text: string,
    keywords: readonly string[],
  ): number {
    if (keywords.length === 0) return 0;
    const lower = text.toLowerCase();
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++;
    }
    return hits / keywords.length;
  }

  /**
   * Clamp a number to [min, max].
   * Delegates to the shared utility — kept as a static method for backward
   * compatibility with existing test call sites (InterventionScorer.clamp).
   */
  static clamp(value: number, min: number, max: number): number {
    return clamp(value, min, max);
  }

  // =========================================================================
  // Static helpers — private
  // =========================================================================

  /**
   * Compute a pressure score from the context's active risks.
   * Higher-severity risks produce more pressure.
   * Returns a value in [0, 1].
   */
  private static riskPressure(context: AgentContextSnapshot): number {
    if (context.risks.length === 0) return 0;
    const totalSeverity = context.risks.reduce(
      (sum, r) => sum + clamp(r.severity, 0, 1),
      0,
    );
    // Average severity, normalized. 3+ high-severity risks → max pressure.
    return clamp(totalSeverity / 3, 0, 1);
  }
}
