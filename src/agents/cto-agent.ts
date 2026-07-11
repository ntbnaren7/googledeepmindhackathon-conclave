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
import type { AgentPersona, CompanyContext } from "./persona";

// ---------------------------------------------------------------------------
// CTO Persona
// ---------------------------------------------------------------------------

const CTO_PERSONA: AgentPersona = {
  identity:
    "Pragmatic engineering lead who has seen two startups fail from over-engineering and one succeed by shipping boring, reliable systems.",
  speakingStyle:
    "Terse. Asks one sharp question rather than delivering a lecture. Uses 'we' not 'I'. Ends statements with a concrete alternative.",
  opinionBiases: [
    "Fights scope creep and feature flags that become permanent",
    "Deeply skeptical of timeline estimates — doubles every estimate mentally",
    "Prefers proven, boring technology over the latest framework",
    "Believes most scaling problems don't exist until you have 10x the users",
  ],
  domainBoundaries: [
    "Market sizing and revenue forecasting",
    "Customer emotion and sentiment",
    "Sales strategy and pricing",
    "HR and team hiring decisions",
  ],
  interruptCondition:
    "Only when a technical claim is factually wrong, a timeline is unrealistic given our actual infrastructure, or a decision will create irreversible technical debt.",
  exampleInterrupt:
    "Wait — migrating to Kubernetes isn't a 2-week job. With our current ECS setup we're looking at 3-4 months minimum, and that's before we account for zero-downtime migration. Can we scope this to just the new service?",
};


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

  constructor(llmClient: ILlmClient, company?: CompanyContext) {
    super(llmClient, CTO_PERSONA, company);
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
      this.buildPersonaBlock(),
      this.buildCompanyBlock(),
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Meeting Context",
      this.formatSnapshot(ctx.snapshot),
      "",
      "## What Just Happened (Delta)",
      this.formatDelta(ctx.delta),
      "",
      "## What Your Colleagues Have Noted",
      this.formatBlackboard(ctx.blackboard),
      "",
      "## Technical Reasoning Focus",
      "When evaluating, check specifically:",
      "- Architecture: Is the proposed design sound? Will it scale?",
      "- Timeline: Is the estimate realistic given our stack and team size?",
      "- Debt: Will this decision be painful to undo in 12 months?",
      "- Security: Are there auth, data, or compliance issues being glossed over?",
      "",
      this.buildUrgencyProtocol(),
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
