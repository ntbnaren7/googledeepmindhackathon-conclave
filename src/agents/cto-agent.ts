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
// CTOAgent
// ---------------------------------------------------------------------------

/**
 * Chief Technology Officer stakeholder agent.
 *
 * Reasons over the already-structured SemanticDelta produced by the
 * upstream pipeline (Perception → Compressor → Context Engine).
 *
 * Evaluates from a technical leadership perspective:
 *   - Architecture and design decisions
 *   - Scalability and performance
 *   - Infrastructure and distributed systems
 *   - Backend design and technical debt
 *   - Security vulnerabilities and compliance
 *
 * This agent does NOT:
 *   - Classify transcript text
 *   - Identify proposals or decisions
 *   - Perform semantic extraction
 *
 * Those responsibilities belong to the Kernel and Perception layers.
 * CTOAgent only provides CTO-specific reasoning over structured data.
 */
export class CTOAgent extends BaseAgent {
  readonly id = "cto";
  readonly role = "cto";
  readonly responsibilities = [
    "Architecture",
    "Scalability",
    "Infrastructure",
    "Backend Design",
    "Distributed Systems",
    "Security",
    "Performance",
    "Technical Debt",
  ];

  constructor(llmClient: ILlmClient) {
    super(llmClient);
  }

  // =========================================================================
  // Hook: build evaluation prompt
  // =========================================================================

  /**
   * CTO-specific evaluation prompt.
   *
   * Instructs the LLM to evaluate structured context through a technical
   * lens. No classification — just reasoning over pre-classified data.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      `You are the CTO / technical leader in this meeting.`,
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Your Reasoning Focus",
      "Evaluate the structured context for technical implications:",
      "- Architecture: coupling, scalability ceiling, tech debt, design patterns",
      "- Infrastructure: deployment, cloud, containers, service mesh",
      "- Distributed systems: consistency, availability, fault tolerance",
      "- Security: auth, encryption, compliance, vulnerability surface",
      "- Performance: latency, throughput, capacity, bottlenecks",
      "- Backend design: API contracts, data models, migration risks",
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
      "If the delta contains a technical concern relevant to your domain,",
      "produce a structured proposal. Otherwise, return null.",
      "Urgency scale: 0.0 (cosmetic) → 0.5 (important) → 1.0 (critical blocker).",
      "Security and data-loss risks should be scored ≥ 0.7.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY reference facts, risks, and concerns explicitly stated in the context above.",
      "- Do NOT invent metrics, benchmarks, or technical details not in the context.",
      "- Do NOT fabricate risks or concerns that aren't mentioned in Topics, Decisions, Assumptions, or Risks.",
      "- If the context lacks sufficient technical information, return null.",
      "",
      "Respond with JSON:",
      `{"proposal": {"agentId": "${this.id}", "content": "<technical recommendation>", "urgency": 0.0-1.0} or null,`,
      ` "blackboardEntries": [{"agentId": "${this.id}", "content": "<observation>"}]}`,
    ].join("\n");
  }

  // =========================================================================
  // Hook: build response prompt
  // =========================================================================

  /**
   * CTO-specific response prompt.
   *
   * Instructs the model to respond as a technical authority who provides
   * clear rationale and acknowledges trade-offs.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      `You are the CTO / technical leader in this meeting.`,
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
      "- Acknowledge trade-offs when you agree.",
      "- Flag specific technical risks when you disagree.",
      "- Reference architectural principles: separation of concerns,",
      "  loose coupling, defense in depth, graceful degradation.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY respond based on the context and proposal above.",
      "- Do NOT invent technical details, metrics, or concerns not in the context.",
      "- Keep your response grounded in what was actually discussed.",
      "",
      "Respond with JSON:",
      '{"content": "<your technical response>", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
    ].join("\n");
  }

  // =========================================================================
  // Hook: parse evaluation output
  // =========================================================================

  /**
   * Parse the LLM response and enforce CTO-specific invariants:
   *   - Proposal agent ID is always "cto"
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

    logger.debug("CTO proposal parsed", {
      urgency: proposal.urgency,
      contentLength: proposal.content.length,
    });

    return { proposal, blackboardEntries: base.blackboardEntries };
  }

  // =========================================================================
  // Hook: parse response output
  // =========================================================================

  /**
   * Parse the LLM response and enforce CTO-specific invariants:
   *   - Content is non-empty
   *   - Tone is one of the allowed values (falls back to "neutral")
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const base = super.parseResponseOutput(raw);

    if (!base.content.trim()) {
      return {
        content:
          "From a technical standpoint, I need more information before weighing in on this.",
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
