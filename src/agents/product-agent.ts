import { IAgentProposal, IAgentResponse } from "@shared/types";
import { logger } from "@shared/logger";
import { clamp } from "@shared/utils";
import {
  BaseAgent,
  EvaluationPromptContext,
  ResponsePromptContext,
  ParsedEvaluation,
} from "./base-agent";
import { ILlmClient } from "./interfaces";

// ---------------------------------------------------------------------------
// ProductAgent
// ---------------------------------------------------------------------------

/**
 * Product stakeholder agent.
 *
 * Reasons over the already-structured SemanticDelta produced by the
 * upstream pipeline (Perception → Compressor → Context Engine).
 *
 * Evaluates from a product leadership perspective:
 *   - User value and customer impact
 *   - MVP scope and prioritization
 *   - UX and usability
 *   - Roadmap alignment
 *   - Feature trade-offs
 *
 * This agent does NOT:
 *   - Classify transcript text
 *   - Identify proposals or decisions
 *   - Perform semantic extraction
 *
 * Those responsibilities belong to the Kernel and Perception layers.
 * ProductAgent only provides product-specific reasoning over structured data.
 */
export class ProductAgent extends BaseAgent {
  readonly id = "product";
  readonly role = "product";
  readonly responsibilities = [
    "User Value",
    "MVP Scope",
    "Prioritization",
    "Customer Impact",
    "UX",
    "Roadmap",
  ];

  constructor(llmClient: ILlmClient) {
    super(llmClient);
  }

  // =========================================================================
  // Hook: build evaluation prompt
  // =========================================================================

  /**
   * Product-specific evaluation prompt.
   *
   * Instructs the LLM to evaluate structured context through a product
   * lens. No classification — just reasoning over pre-classified data.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      `You are the Product lead in this meeting.`,
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Your Reasoning Focus",
      "Evaluate the structured context for product implications:",
      "- User value: does this move the needle for users?",
      "- MVP scope: is this essential for launch or can it wait?",
      "- Prioritization: does this align with product goals?",
      "- Customer impact: how many users are affected and how deeply?",
      "- UX: does this improve or degrade the user experience?",
      "- Roadmap: does this advance or derail our planned trajectory?",
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
      "If the delta contains a product concern relevant to your domain,",
      "produce a structured proposal. Otherwise, return null.",
      "Urgency scale: 0.0 (cosmetic) → 0.5 (important) → 1.0 (critical blocker).",
      "User-facing issues affecting launch should be scored ≥ 0.7.",
      "",
      "Respond with JSON:",
      `{"proposal": {"agentId": "${this.id}", "content": "<product recommendation>", "urgency": 0.0-1.0} or null,`,
      ` "blackboardEntries": [{"agentId": "${this.id}", "content": "<observation>"}]}`,
    ].join("\n");
  }

  // =========================================================================
  // Hook: build response prompt
  // =========================================================================

  /**
   * Product-specific response prompt.
   *
   * Instructs the model to respond as a product advocate who considers
   * user needs, business goals, and shipping velocity.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      `You are the Product lead in this meeting.`,
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
      "- Evaluate impact on users and shipping timeline.",
      "- Flag scope creep when you see it.",
      "- Acknowledge user-centric reasoning when you agree.",
      "- Push back on technical over-engineering that delays value delivery.",
      "",
      "Respond with JSON:",
      '{"content": "<your product perspective>", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
    ].join("\n");
  }

  // =========================================================================
  // Hook: parse evaluation output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Product-specific invariants:
   *   - Proposal agent ID is always "product"
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

    logger.debug("Product proposal parsed", {
      urgency: proposal.urgency,
      contentLength: proposal.content.length,
    });

    return { proposal, blackboardEntries: base.blackboardEntries };
  }

  // =========================================================================
  // Hook: parse response output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Product-specific invariants:
   *   - Content is non-empty
   *   - Tone is one of the allowed values (falls back to "neutral")
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const base = super.parseResponseOutput(raw);

    if (!base.content.trim()) {
      return {
        content:
          "From a product perspective, I need to understand the user impact before weighing in.",
        tone: "cautious",
      };
    }

    return base;
  }
}
