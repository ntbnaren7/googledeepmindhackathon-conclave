import {
  IContextSnapshot,
  ISemanticDelta,
  IAgentProposal,
  IAgentResponse,
} from "@shared/types";
import { logger } from "@shared/logger";
import {
  BaseAgent,
  EvaluationPromptContext,
  ResponsePromptContext,
  ParsedEvaluation,
} from "./base-agent";
import { ILlmClient } from "./interfaces";

// ---------------------------------------------------------------------------
// CTO domain knowledge
// ---------------------------------------------------------------------------

/** Signal words that indicate architecture / infrastructure topics. */
const ARCHITECTURE_KEYWORDS: readonly string[] = [
  "architecture",
  "scalability",
  "microservice",
  "monolith",
  "database",
  "cache",
  "load balanc",
  "api",
  "service mesh",
  "infrastructure",
  "kubernetes",
  "docker",
  "deploy",
  "cloud",
  "latency",
  "throughput",
  "concurrency",
  "migration",
];

/** Signal words that indicate reliability concerns. */
const RELIABILITY_KEYWORDS: readonly string[] = [
  "reliability",
  "availability",
  "uptime",
  "downtime",
  "failover",
  "redundancy",
  "disaster recovery",
  "backup",
  "fault tolerant",
  "resilience",
  "slsa",
  "slo",
  "sli",
  "error budget",
  "incident",
  "outage",
];

/** Signal words that indicate security concerns. */
const SECURITY_KEYWORDS: readonly string[] = [
  "security",
  "vulnerability",
  "auth",
  "authentication",
  "authorization",
  "encryption",
  "token",
  "secret",
  "credential",
  "injection",
  "xss",
  "csrf",
  "compliance",
  "gdpr",
  "audit",
  "penetration",
  "threat",
];

// ---------------------------------------------------------------------------
// CTOAgent
// ---------------------------------------------------------------------------

/**
 * Chief Technology Officer stakeholder agent.
 *
 * Evaluates the meeting from a technical leadership perspective:
 *   - Architecture and design decisions
 *   - Scalability and performance
 *   - Backend and infrastructure concerns
 *   - Reliability, availability, and disaster recovery
 *   - Security vulnerabilities and compliance
 *
 * All CTO-specific logic (prompt templates, domain detection, response
 * formatting) lives in this class.  BaseAgent handles the pipeline.
 */
export class CTOAgent extends BaseAgent {
  readonly id = "cto";
  readonly role = "cto";
  readonly responsibilities = [
    "Architecture",
    "Scalability",
    "Backend",
    "Infrastructure",
    "Reliability",
    "Security",
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
   * Extends the base prompt with:
   *   - A checklist of technical concerns to evaluate
   *   - Explicit instructions to produce a structured proposal
   *   - Domain-specific urgency guidance (security > reliability > perf)
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    const technicalSignals = this.detectTechnicalSignals(ctx.snapshot, ctx.delta);

    return [
      `You are the CTO / technical leader in this meeting.`,
      `Your domain: ${this.responsibilities.join(", ")}.`,
      "",
      "## Your Evaluation Checklist",
      "For every new topic, decision, or assumption, assess:",
      "1. Does this create an architectural risk? (coupling, scalability ceiling, tech debt)",
      "2. Does this affect reliability? (uptime, failover, data loss)",
      "3. Does this introduce a security concern? (auth, encryption, compliance)",
      "4. Does this impact backend performance? (latency, throughput, capacity)",
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
      ...(technicalSignals.length > 0
        ? ["## Detected Technical Signals", ...technicalSignals, ""]
        : []),
      "## Instructions",
      "If you identify a technical concern, produce a structured proposal.",
      "Urgency scale: 0.0 (cosmetic) → 0.5 (important) → 1.0 (critical blocker).",
      "Security and data-loss risks should be scored ≥ 0.7.",
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

    // Enforce CTO agent ID and clamp urgency
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

    // If the base returned empty content, provide a CTO-appropriate fallback
    if (!base.content.trim()) {
      return {
        content:
          "From a technical standpoint, I need more information before weighing in on this.",
        tone: "cautious",
      };
    }

    return base;
  }

  // =========================================================================
  // Private CTO domain helpers
  // =========================================================================

  /**
   * Scan the context snapshot and delta for technical signals.
   * Returns a list of human-readable observations for the LLM prompt.
   */
  private detectTechnicalSignals(
    snapshot: IContextSnapshot,
    delta: ISemanticDelta,
  ): string[] {
    const signals: string[] = [];

    // Check snapshot risks for architecture/reliability/security concerns
    for (const risk of snapshot.risks) {
      const category = this.classifyRisk(risk.description);
      if (category) {
        signals.push(
          `[${category}] Risk detected: "${risk.description}" (severity ${risk.severity})`,
        );
      }
    }

    // Check delta for new decisions that touch CTO domain
    for (const decision of delta.decisions) {
      const category = this.classifyText(decision.description);
      if (category) {
        signals.push(
          `[${category}] Decision proposed: "${decision.description}"`,
        );
      }
    }

    // Check delta for unchallenged assumptions in CTO domain
    for (const assumption of delta.assumptions) {
      if (!assumption.challenged) {
        const category = this.classifyText(assumption.statement);
        if (category) {
          signals.push(
            `[${category}] Unchallenged assumption: "${assumption.statement}"`,
          );
        }
      }
    }

    // Check delta topics for CTO-relevant subjects
    for (const topic of delta.topics) {
      const category = this.classifyText(topic.label);
      if (category) {
        signals.push(`[${category}] Topic introduced: "${topic.label}"`);
      }
    }

    return signals;
  }

  /**
   * Classify free-text into a CTO domain category.
   * Returns the category name or null if not CTO-relevant.
   */
  private classifyText(text: string): string | null {
    const lower = text.toLowerCase();

    if (matchesAny(lower, SECURITY_KEYWORDS)) return "Security";
    if (matchesAny(lower, RELIABILITY_KEYWORDS)) return "Reliability";
    if (matchesAny(lower, ARCHITECTURE_KEYWORDS)) return "Architecture";

    return null;
  }

  /**
   * Classify a risk description specifically.
   * Returns the domain category or null.
   */
  private classifyRisk(description: string): string | null {
    return this.classifyText(description);
  }

}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/** Check if any keyword from the list appears in the text. */
function matchesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
