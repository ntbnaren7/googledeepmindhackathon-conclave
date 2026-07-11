import { IAgentProposal, IAgentResponse } from "@shared/types";
import { logger } from "@shared/logger";
import {
  BaseAgent,
  EvaluationPromptContext,
  ResponsePromptContext,
  ParsedEvaluation,
} from "./base-agent";
import { ILlmClient } from "./interfaces";

// ---------------------------------------------------------------------------
// ResearchAgent
// ---------------------------------------------------------------------------

/**
 * Research stakeholder agent.
 *
 * Reasons over the already-structured SemanticDelta produced by the
 * upstream pipeline (Perception → Compressor → Context Engine).
 *
 * Evaluates from an evidence-driven perspective:
 *   - Missing evidence in current reasoning
 *   - Unsupported assumptions that need validation
 *   - Research gaps in the decision-making process
 *   - Benchmarking opportunities to ground claims
 *   - Validation needs before committing to a direction
 *
 * This agent does NOT:
 *   - Classify transcript text
 *   - Identify proposals or decisions
 *   - Perform semantic extraction
 *
 * Those responsibilities belong to the Kernel and Perception layers.
 * ResearchAgent only provides evidence-focused reasoning over structured data.
 */
export class ResearchAgent extends BaseAgent {
  readonly id = "research";
  readonly role = "research";
  readonly responsibilities = [
    "Missing Evidence",
    "Unsupported Assumptions",
    "Research Gaps",
    "Benchmarking",
    "Validation",
  ];

  constructor(llmClient: ILlmClient) {
    super(llmClient);
  }

  // =========================================================================
  // Hook: build evaluation prompt
  // =========================================================================

  /**
   * Research-specific evaluation prompt.
   *
   * Instructs the LLM to evaluate structured context through an
   * evidence-focused lens. No classification — just reasoning over
   * pre-classified data.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      `You are the Research lead in this meeting.`,
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Your Reasoning Focus",
      "Evaluate the structured context for evidence gaps:",
      "- Missing evidence: what claims lack supporting data?",
      "- Unsupported assumptions: what is being taken on faith?",
      "- Research gaps: what questions remain unanswered?",
      "- Benchmarking: what comparisons would strengthen the argument?",
      "- Validation: what needs testing before we commit?",
      "",
      "## Current Context",
      this.formatSnapshot(ctx.snapshot),
      "",
      "## Recent Changes (Delta)",
      this.formatDelta(ctx.delta),
      "",
      "## Blackboard (Other Agents' Posts)",
      this.formatBlackboard(ctx.blackboard),
      "",
      "## Instructions",
      "If the delta contains claims or decisions lacking evidence,",
      "produce a structured proposal. Otherwise, return null.",
      "Urgency scale: 0.0 (cosmetic) → 0.5 (important) → 1.0 (critical blocker).",
      "Unvalidated assumptions with high impact should be scored ≥ 0.7.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY reference facts, risks, and concerns explicitly stated in the context above.",
      "- Do NOT invent metrics, benchmarks, or technical details not in the context.",
      "- Do NOT fabricate risks or concerns that aren't mentioned in Topics, Decisions, Assumptions, or Risks.",
      "- If the context lacks sufficient information for your domain, return null.",
      "",
      "Respond with JSON:",
      `{"proposal": {"agentId": "${this.id}", "content": "<research recommendation>", "urgency": 0.0-1.0} or null,`,
      ` "blackboardEntries": [{"agentId": "${this.id}", "content": "<observation>"}]}`,
    ].join("\n");
  }

  // =========================================================================
  // Hook: build response prompt
  // =========================================================================

  /**
   * Research-specific response prompt.
   *
   * Instructs the model to respond as an evidence advocate who
   * grounds decisions in data and flags unsupported claims.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      `You are the Research lead in this meeting.`,
      "",
      "## Current Context",
      this.formatSnapshot(ctx.snapshot),
      "",
      "## Proposal to Respond To",
      `Agent: ${ctx.proposal.agentId}`,
      `Content: ${ctx.proposal.content}`,
      `Urgency: ${ctx.proposal.urgency}`,
      "",
      "## Response Guidelines",
      "- Ask what evidence supports this claim.",
      "- Flag assumptions that need validation.",
      "- Suggest benchmarks or comparisons where relevant.",
      "- Acknowledge well-supported reasoning when you see it.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY respond based on the context and proposal above.",
      "- Do NOT invent details, metrics, or concerns not present in the context.",
      "- Keep your response grounded in what was actually discussed.",
      "",
      "Respond with JSON:",
      '{"content": "<your research perspective>", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
    ].join("\n");
  }

  // =========================================================================
  // Hook: parse evaluation output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Research-specific invariants:
   *   - Proposal agent ID is always "research"
   *   - Urgency is clamped to [0, 1]
   *   - Content is non-empty if a proposal is present
   */
  protected parseEvaluationOutput(raw: string): ParsedEvaluation {
    const base = super.parseEvaluationOutput(raw);

    if (!base.proposal) {
      return base;
    }

    const proposal: IAgentProposal = {
      agentId: this.id,
      content: base.proposal.content,
      urgency: clamp(base.proposal.urgency, 0, 1),
    };

    logger.debug("Research proposal parsed", {
      urgency: proposal.urgency,
      contentLength: proposal.content.length,
    });

    return { proposal, blackboardEntries: base.blackboardEntries };
  }

  // =========================================================================
  // Hook: parse response output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Research-specific invariants:
   *   - Content is non-empty
   *   - Tone is one of the allowed values (falls back to "neutral")
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const base = super.parseResponseOutput(raw);

    if (!base.content.trim()) {
      return {
        content:
          "From a research perspective, I'd need to see supporting evidence before weighing in.",
        tone: "cautious",
      };
    }

    return base;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
