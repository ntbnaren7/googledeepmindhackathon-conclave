import {
  AgentContextSnapshot,
  SemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
  IBlackboardEntry,
} from "@shared/types";
import { logger } from "@shared/logger";
import { RUNTIME_CONSTANTS } from "@shared/constants";
import { extractJson } from "@shared/utils";
import { InterventionScorer } from "./intervention-scorer";
import { IStakeholderAgent, ILlmClient } from "./interfaces";
import type { AgentPersona, CompanyContext } from "./persona";

// ---------------------------------------------------------------------------
// Types consumed by the child-class hook methods
// ---------------------------------------------------------------------------

/** Everything a child needs to build an evaluation prompt. */
export interface EvaluationPromptContext {
  snapshot: AgentContextSnapshot;
  delta: SemanticDelta;
  blackboard: IBlackboardState;
  responsibilities: string[];
  role: string;
}

/** Everything a child needs to build a response prompt. */
export interface ResponsePromptContext {
  snapshot: AgentContextSnapshot;
  proposal: IAgentProposal;
  role: string;
}

/** Structured output of the evaluation LLM call, before novelty scoring. */
export interface ParsedEvaluation {
  proposal: IAgentProposal | null;
  blackboardEntries: IBlackboardEntry[];
  /** The exact text from the delta/transcript that triggered the proposal. */
  triggerQuote?: string;
  /** One-sentence rationale for the urgency score chosen. */
  urgencyReason?: string;
}

// ---------------------------------------------------------------------------
// BaseAgent — shared evaluation pipeline for all stakeholder agents
// ---------------------------------------------------------------------------

/**
 * Implements the two-phase pipeline every agent follows:
 *
 *  **evaluate** (decide whether to intervene)
 *    1. Check relevance of delta against agent's domain
 *    2. If relevant, assemble prompt context
 *    3. Build prompt via child hook          (buildEvaluationPrompt)
 *    4. Call injected LLM client             (llmClient.generate)
 *    5. Parse raw text → structured data     (parseEvaluationOutput)
 *    6. Filter duplicate proposals           (filterByNovelty)
 *    7. Record proposal in history
 *    8. Return IAgentResult
 *
 *  **generateResponse** (speak after being granted the floor)
 *    1. Assemble prompt context from snapshot + proposal
 *    2. Build prompt via child hook          (buildResponsePrompt)
 *    3. Call injected LLM client             (llmClient.generate)
 *    4. Parse raw text → structured response (parseResponseOutput)
 *    5. Return IAgentResponse
 *
 * Child classes override the four hook methods to provide domain-specific
 * prompts and output parsing.  Everything else stays in the base class.
 *
 * Important architectural constraints:
 *   - Does NOT inspect raw transcript or classify conversation
 *   - Does NOT detect proposals/assumptions/decisions (done by Kernel)
 *   - Does NOT extract semantic units (done by Perception/Compressor)
 *   - Receives already-structured data from upstream pipeline
 */
export abstract class BaseAgent implements IStakeholderAgent {
  abstract readonly id: string;
  abstract readonly role: string;
  abstract readonly responsibilities: string[];

  private readonly llmClient: ILlmClient;
  private readonly scorer = new InterventionScorer();
  private proposalHistory: IAgentProposal[] = [];

  /** Character and company context — injected at construction. */
  protected readonly persona?: AgentPersona;
  protected readonly company?: CompanyContext;

  constructor(llmClient: ILlmClient, persona?: AgentPersona, company?: CompanyContext) {
    this.llmClient = llmClient;
    this.persona = persona;
    this.company = company;
  }

  // =========================================================================
  // Public pipeline — do NOT override in child classes
  // =========================================================================

  /**
   * Phase 1 — Evaluate the current context and decide whether to propose
   * an intervention.  Returns the proposal (if any) plus blackboard entries
   * that other agents can read.
   */
  async evaluate(
    snapshot: AgentContextSnapshot,
    delta: SemanticDelta,
    blackboard: IBlackboardState,
  ): Promise<IAgentResult> {
    try {
      // Step 0 — lightweight relevance check
      if (!this.isRelevantDelta(delta)) {
        logger.debug("Delta not relevant to agent", {
          agentId: this.id,
        });
        return { proposal: null, blackboardEntries: [] };
      }

      // Step 1 — assemble the prompt context for the child hook
      const promptCtx: EvaluationPromptContext = {
        snapshot,
        delta,
        blackboard,
        responsibilities: this.responsibilities,
        role: this.role,
      };

      // Step 2 — delegate prompt creation to the child class
      const prompt = this.buildEvaluationPrompt(promptCtx);

      // Step 3 — send the prompt to the injected LLM client
      const raw = await this.llmClient.generate(prompt);

      // Step 4 — parse the raw LLM response into structured data
      const parsed = this.parseEvaluationOutput(raw);

      // Step 5 — carry triggerQuote/urgencyReason into the proposal
      if (parsed.proposal && (parsed.triggerQuote || parsed.urgencyReason)) {
        (parsed.proposal as IAgentProposal).triggerQuote = parsed.triggerQuote;
        (parsed.proposal as IAgentProposal).urgencyReason = parsed.urgencyReason;
      }

      // Step 5 — suppress proposals that duplicate recent ones
      const filtered = this.filterByNovelty(parsed);

      // Step 6 — record proposal for future novelty checks
      if (filtered.proposal) {
        this.proposalHistory.push(filtered.proposal);
      }

      logger.debug("Agent evaluation complete", {
        agentId: this.id,
        hasProposal: filtered.proposal !== null,
        blackboardEntries: filtered.blackboardEntries.length,
      });

      return filtered;
    } catch (err) {
      logger.error("Agent evaluation failed", {
        agentId: this.id,
        error: String(err),
      });
      return { proposal: null, blackboardEntries: [] };
    }
  }

  /**
   * Phase 2 — Generate a spoken response after being granted the floor
   * by the attention gate / arbitrator.
   */
  async generateResponse(
    snapshot: AgentContextSnapshot,
    proposal: IAgentProposal,
  ): Promise<IAgentResponse> {
    try {
      // Step 1 — assemble the prompt context for the child hook
      const promptCtx: ResponsePromptContext = {
        snapshot,
        proposal,
        role: this.role,
      };

      // Step 2 — delegate prompt creation to the child class
      const prompt = this.buildResponsePrompt(promptCtx);

      // Step 3 — send the prompt to the injected LLM client
      const raw = await this.llmClient.generate(prompt);

      // Step 4 — parse the raw LLM response
      const response = this.parseResponseOutput(raw);

      logger.debug("Agent response generated", {
        agentId: this.id,
        tone: response.tone,
      });

      return response;
    } catch (err) {
      logger.error("Agent response generation failed", {
        agentId: this.id,
        error: String(err),
      });
      return { content: "", tone: "neutral" };
    }
  }

  /** Clear all per-cycle state (proposal history, etc.). */
  reset(): void {
    this.proposalHistory = [];
    logger.debug("Agent state reset", { agentId: this.id });
  }

  // =========================================================================
  // Hook methods — override in child classes to specialize behaviour
  // =========================================================================

  /**
   * Check if the semantic delta is relevant to this agent's domain.
   * Default implementation returns true for all deltas.
   * Override to filter out irrelevant updates (e.g., CTO ignores marketing).
   */
  protected isRelevantDelta(_delta: SemanticDelta): boolean {
    return true;
  }

  /**
   * Build the LLM prompt used during the evaluation phase.
   * Subclasses should call super's helpers (buildPersonaBlock, buildCompanyBlock)
   * at the top of their override to maintain consistent structure.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      this.buildPersonaBlock(),
      this.buildCompanyBlock(),
      `Your domain responsibilities: ${ctx.responsibilities.join(", ")}.`,
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
      this.buildUrgencyProtocol(),
    ].join("\n");
  }

  /**
   * Build the LLM prompt used when generating a spoken response.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      this.buildPersonaBlock(),
      this.buildCompanyBlock(),
      "",
      "## Meeting Context",
      this.formatSnapshot(ctx.snapshot),
      "",
      "## You Have Been Granted the Floor",
      `Your proposal was: ${ctx.proposal.content}`,
      ctx.proposal.triggerQuote ? `You were triggered by: "${ctx.proposal.triggerQuote}"` : "",
      "",
      "## Response Guidelines",
      "- Speak as yourself — use your voice, your style.",
      "- Be specific: reference actual claims or numbers from the conversation.",
      "- Be brief: 1-3 sentences max. This is a meeting interruption, not a presentation.",
      "- If a colleague noted something relevant, build on or challenge it explicitly.",
      "",
      "Respond with JSON:",
      '{"content": "<your spoken response>", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
      "",
      "## CRITICAL: Anti-Hallucination Rules",
      "- ONLY respond based on the context and proposal above.",
      "- Do NOT invent details, metrics, or concerns not present in the context.",
      "- Keep your response grounded in what was actually discussed.",
    ].join("\n");
  }

  /**
   * Parse the raw LLM text from evaluate() into a ParsedEvaluation.
   * Default implementation extracts the first JSON object it finds
   * and coerces the fields into the correct shape.
   */
  protected parseEvaluationOutput(raw: string): ParsedEvaluation {
    const json = extractJson(raw);
    if (!json) {
      return { proposal: null, blackboardEntries: [] };
    }

    const proposal =
      this.isValidProposal(json.proposal)
        ? { ...(json.proposal as IAgentProposal), agentId: this.id }
        : null;

    const blackboardEntries: IBlackboardEntry[] = Array.isArray(
      json.blackboardEntries,
    )
      ? (json.blackboardEntries as Record<string, unknown>[]).map((e) => ({
          agentId: this.id,
          content: String(e.content ?? ""),
          timestamp: Date.now(),
        }))
      : [];

    return {
      proposal,
      blackboardEntries,
      triggerQuote: typeof json.triggerQuote === 'string' ? json.triggerQuote : undefined,
      urgencyReason: typeof json.urgencyReason === 'string' ? json.urgencyReason : undefined,
    };
  }

  /**
   * Parse the raw LLM text from generateResponse() into an IAgentResponse.
   * Default implementation extracts JSON and coerces the tone field.
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const json = extractJson(raw);
    if (!json) {
      return { content: raw || "", tone: "neutral" };
    }

    const tone = this.isValidTone(json.tone) ? json.tone : "neutral";
    return { content: String(json.content ?? ""), tone };
  }

  // =========================================================================
  // Private pipeline helpers
  // =========================================================================

  /**
   * Scores a proposal against recent history using the InterventionScorer.
   * If novelty falls below the deduplication threshold the proposal is
   * suppressed (set to null) to avoid redundant interventions.
   */
  private filterByNovelty(parsed: ParsedEvaluation): ParsedEvaluation {
    if (!parsed.proposal) {
      return parsed;
    }

    const novelty = this.scorer.calculateNovelty(
      parsed.proposal.content,
      this.proposalHistory,
    );

    if (novelty < RUNTIME_CONSTANTS.DEDUPLICATION_SIMILARITY) {
      logger.debug("Proposal suppressed as duplicate", {
        agentId: this.id,
        novelty,
      });
      return { ...parsed, proposal: null };
    }

    return parsed;
  }

  /** Type guard — validates that a value has the shape of IAgentProposal. */
  private isValidProposal(value: unknown): value is IAgentProposal {
    return (
      typeof value === "object" &&
      value !== null &&
      "content" in value &&
      typeof (value as IAgentProposal).content === "string" &&
      (value as IAgentProposal).content.length > 0
    );
  }

  /** Type guard — validates that a value is a legal IAgentResponse tone. */
  private isValidTone(value: unknown): value is IAgentResponse["tone"] {
    return (
      value === "neutral" ||
      value === "supportive" ||
      value === "opposed" ||
      value === "cautious"
    );
  }

  /** Format a context snapshot into a human-readable string for LLM prompts. */
  protected formatSnapshot(snap: AgentContextSnapshot): string {
    const lines: string[] = [];
    if (snap.topics.length > 0) {
      lines.push(`Topics: ${snap.topics.map((t) => t.label).join(", ")}`);
    }
    if (snap.decisions.length > 0) {
      lines.push(
        `Decisions: ${snap.decisions.map((d) => `[${d.status}] ${d.description}`).join("; ")}`,
      );
    }
    if (snap.assumptions.length > 0) {
      lines.push(
        `Assumptions: ${snap.assumptions.map((a) => `${a.statement}${a.challenged ? " [CHALLENGED]" : ""}`).join("; ")}`,
      );
    }
    if (snap.risks.length > 0) {
      lines.push(
        `Risks: ${snap.risks.map((r) => `${r.description} (severity: ${r.severity})`).join("; ")}`,
      );
    }
    return lines.length > 0 ? lines.join("\n") : "(No context available)";
  }

  /** Format a semantic delta into a human-readable string for LLM prompts. */
  protected formatDelta(delta: SemanticDelta): string {
    const lines: string[] = [];
    if (delta.units.length > 0) {
      lines.push(`New utterances: ${delta.units.length}`);
    }
    if (delta.topics.length > 0) {
      lines.push(`Topics: ${delta.topics.map((t) => t.label).join(", ")}`);
    }
    if (delta.decisions.length > 0) {
      lines.push(
        `Decisions: ${delta.decisions.map((d) => d.description).join("; ")}`,
      );
    }
    if (delta.assumptions.length > 0) {
      lines.push(
        `Assumptions: ${delta.assumptions.map((a) => a.statement).join("; ")}`,
      );
    }
    if (delta.risks.length > 0) {
      lines.push(
        `Risks: ${delta.risks.map((r) => r.description).join("; ")}`,
      );
    }
    return lines.length > 0 ? lines.join("\n") : "(No changes)";
  }

  /** Format the blackboard state into a rich, human-readable string that encourages agent-to-agent dialogue. */
  protected formatBlackboard(blackboard: IBlackboardState): string {
    if (blackboard.length === 0) return "(No colleagues have posted anything yet)";
    const now = Date.now();
    const lines = blackboard.map((e) => {
      const ageMs = now - (e.timestamp ?? now);
      const ageLabel = ageMs < 30_000 ? 'just now'
        : ageMs < 120_000 ? `${Math.round(ageMs / 1000)}s ago`
        : `${Math.round(ageMs / 60_000)}m ago`;
      const agentLabel = e.agentId.toUpperCase();
      return `→ ${agentLabel} noted (${ageLabel}): "${e.content}"`;
    });
    return [
      ...lines,
      "",
      `If any of the above is directly relevant to YOUR concern, address it explicitly.`,
      `Start with "Building on what ${blackboard[0]?.agentId ?? 'my colleague'} said..." or "I'd push back on that — ..."`
    ].join("\n");
  }

  // =========================================================================
  // Persona + company helpers
  // =========================================================================

  /**
   * Renders the agent's character card — injected at the top of every prompt.
   * Returns empty string if no persona is set (graceful degradation).
   */
  protected buildPersonaBlock(): string {
    if (!this.persona) {
      return `You are a ${this.role} stakeholder in this meeting.`;
    }
    return [
      `## Who You Are`,
      `${this.persona.identity}`,
      ``,
      `**How you speak:** ${this.persona.speakingStyle}`,
      `**What you care about:** ${this.persona.opinionBiases.join('; ')}.`,
      `**What you do NOT comment on:** ${this.persona.domainBoundaries.join(', ')}.`,
      `**You only interrupt when:** ${this.persona.interruptCondition}`,
      ``,
      `When you do speak, you sound like this:`,
      `"${this.persona.exampleInterrupt}"`,
    ].join('\n');
  }

  /**
   * Renders the company context block — shared ground truth for all agents.
   * Returns empty string if no company is set.
   */
  protected buildCompanyBlock(): string {
    if (!this.company) return '';
    return [
      ``,
      `## Company Context`,
      `**${this.company.name}** — ${this.company.stage}`,
      `Domain: ${this.company.domain} | Team: ${this.company.teamSize} people`,
      `Tech stack: ${this.company.techStack.join(', ')}`,
      `Current priorities: ${this.company.currentPriorities.join('; ')}`,
      `Recent decisions: ${this.company.recentDecisions.join('; ')}`,
      `Meeting objective: ${this.company.meetingObjective}`,
    ].join('\n');
  }

  /**
   * Builds the chain-of-thought urgency reasoning protocol.
   * Forces the agent to justify its urgency score before outputting it.
   */
  protected buildUrgencyProtocol(): string {
    const boundaries = this.persona?.domainBoundaries.join(', ') ?? 'out-of-domain topics';
    const condition = this.persona?.interruptCondition ?? 'when you have something genuinely important to add';
    return [
      `## Decision Protocol — Follow These Steps In Order`,
      ``,
      `**Step 1 — Domain Check:** Does this delta touch your domain (${this.responsibilities.join(', ')})?`,
      `If NO → return null proposal immediately.`,
      ``,
      `**Step 2 — Trigger Identification:** Quote the EXACT text from the delta that concerns you.`,
      `What is specifically wrong or risky about it?`,
      ``,
      `**Step 3 — Urgency Calibration** (use ONLY this scale):`,
      `- 0.1–0.3: Nice to mention later, not time-sensitive`,
      `- 0.4–0.6: Should be said in this meeting, the team needs to know`,
      `- 0.7–0.8: Must be said NOW — a decision is being made on wrong assumptions`,
      `- 0.9–1.0: STOP THE ROOM. Serious harm if not corrected immediately`,
      ``,
      `**Step 4 — Boundary Check:** Does this cross into [${boundaries}]? If YES → null.`,
      ``,
      `**Step 5 — Silence Check:** Would a real expert stay quiet here?`,
      `You only interrupt when: ${condition}`,
      ``,
      `Respond ONLY with this JSON (no prose, no markdown fences):`,
      `{`,
      `  "shouldSpeak": true|false,`,
      `  "triggerQuote": "exact text from delta that triggered this — or null",`,
      `  "urgencyReason": "one sentence: why THIS urgency level specifically",`,
      `  "proposal": {"agentId": "${this.id}", "content": "<your intervention — 1-2 sentences>", "urgency": 0.0-1.0} | null,`,
      `  "blackboardEntries": [{"agentId": "${this.id}", "content": "<observation for other agents>"}]`,
      `}`,
    ].join('\n');
  }
}
