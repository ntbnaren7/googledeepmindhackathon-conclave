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

const FINANCE_PERSONA: AgentPersona = {
  identity:
    "Ex-investment banker turned VP Finance at three startups. Converts every idea into a number before forming an opinion.",
  speakingStyle:
    "Direct. Always asks 'what's the cost of NOT doing this'. Finishes statements with numbers or asks for them. Never uses vague cost language without quantifying it.",
  opinionBiases: [
    "Hates undefined capex — will always ask for the actual number",
    "Loves payback period calculations and break-even analysis",
    "Suspicious of 'saves time' without quantification in hours and hourly cost",
    "Believes every decision has a financial alternative that should be compared",
  ],
  domainBoundaries: [
    "Technical architecture decisions",
    "Product UX and feature design",
    "Engineering effort estimation",
    "Customer emotion or user experience",
  ],
  interruptCondition:
    "Only when a financial assumption is made without a source, spend is discussed without ROI context, or a decision will materially impact our runway or unit economics.",
  exampleInterrupt:
    "Hold on — you said 'not that expensive'. What's the actual number? Based on our AWS usage patterns, this would add roughly $8-12k per month. That's 3% of our monthly burn. Is that in the Q3 budget?",
};

// ---------------------------------------------------------------------------
// FinanceAgent
// ---------------------------------------------------------------------------

/**
 * Finance stakeholder agent.
 *
 * Reasons over the already-structured SemanticDelta produced by the
 * upstream pipeline (Perception → Compressor → Context Engine).
 *
 * Evaluates from a financial perspective:
 *   - Cost implications of decisions
 *   - ROI and return on investment
 *   - Operational expense (OpEx) and infrastructure spending
 *   - Monetization strategy and revenue impact
 *   - Financial risk exposure
 *
 * This agent does NOT:
 *   - Classify transcript text
 *   - Identify proposals or decisions
 *   - Perform semantic extraction
 *
 * Those responsibilities belong to the Kernel and Perception layers.
 * FinanceAgent only provides financial reasoning over structured data.
 */
export class FinanceAgent extends BaseAgent {
  readonly id = "finance";
  readonly role = "finance";
  readonly responsibilities = [
    "Cost",
    "ROI",
    "Operational Expense",
    "Infrastructure Spending",
    "Monetization",
    "Financial Risk",
  ];

  constructor(llmClient: ILlmClient, company?: CompanyContext) {
    super(llmClient, FINANCE_PERSONA, company);
  }

  // =========================================================================
  // Hook: build evaluation prompt
  // =========================================================================

  /**
   * Finance-specific evaluation prompt.
   *
   * Instructs the LLM to evaluate structured context through a financial
   * lens. No classification — just reasoning over pre-classified data.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      `You are the Finance lead in this meeting.`,
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Your Reasoning Focus",
      "Evaluate the structured context for financial implications:",
      "- Cost: what does this cost to build, operate, maintain?",
      "- ROI: does the expected return justify the investment?",
      "- OpEx: what are the ongoing operational expenses?",
      "- Infrastructure spending: cloud, hosting, licensing costs?",
      "- Monetization: how does this affect revenue or pricing?",
      "- Financial risk: what is the downside exposure?",
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
      "If the delta contains a financial concern relevant to your domain,",
      "produce a structured proposal. Otherwise, return null.",
      "Urgency scale: 0.0 (cosmetic) → 0.5 (important) → 1.0 (critical blocker).",
      "Budget overruns or revenue risks should be scored ≥ 0.7.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY reference facts, risks, and concerns explicitly stated in the context above.",
      "- Do NOT invent metrics, benchmarks, or technical details not in the context.",
      "- Do NOT fabricate risks or concerns that aren't mentioned in Topics, Decisions, Assumptions, or Risks.",
      "- If the context lacks sufficient information for your domain, return null.",
      "",
      "Respond with JSON:",
      `{"proposal": {"agentId": "${this.id}", "content": "<financial recommendation>", "urgency": 0.0-1.0} or null,`,
      ` "blackboardEntries": [{"agentId": "${this.id}", "content": "<observation>"}]}`,
    ].join("\n");
  }

  // =========================================================================
  // Hook: build response prompt
  // =========================================================================

  /**
   * Finance-specific response prompt.
   *
   * Instructs the model to respond as a financial steward who grounds
   * decisions in cost-benefit analysis and risk assessment.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      `You are the Finance lead in this meeting.`,
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
      "- Quantify costs when possible.",
      "- Flag budget impacts and ROI concerns.",
      "- Acknowledge cost-effective solutions when you see them.",
      "- Push back on spending that lacks clear return.",
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY respond based on the context and proposal above.",
      "- Do NOT invent details, metrics, or concerns not present in the context.",
      "- Keep your response grounded in what was actually discussed.",
      "",
      "Respond with JSON:",
      '{"content": "<your financial perspective>", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
    ].join("\n");
  }

  // =========================================================================
  // Hook: parse evaluation output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Finance-specific invariants:
   *   - Proposal agent ID is always "finance"
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

    logger.debug("Finance proposal parsed", {
      urgency: proposal.urgency,
      contentLength: proposal.content.length,
    });

    return { proposal, blackboardEntries: base.blackboardEntries };
  }

  // =========================================================================
  // Hook: parse response output
  // =========================================================================

  /**
   * Parse the LLM response and enforce Finance-specific invariants:
   *   - Content is non-empty
   *   - Tone is one of the allowed values (falls back to "neutral")
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const base = super.parseResponseOutput(raw);

    if (!base.content.trim()) {
      return {
        content:
          "From a financial perspective, I need cost data before weighing in on this.",
        tone: "cautious",
      };
    }

    return base;
  }
}
