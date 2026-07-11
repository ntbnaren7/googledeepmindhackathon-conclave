import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
  IBlackboardEntry,
} from "@shared/types";
import { logger } from "@shared/logger";
import { RUNTIME_CONSTANTS } from "@shared/constants";
import { InterventionScorer } from "./intervention-scorer";
import { IStakeholderAgent } from "./interfaces";

// ---------------------------------------------------------------------------
// Types consumed by the child-class hook methods
// ---------------------------------------------------------------------------

/** Everything a child needs to build an evaluation prompt. */
export interface EvaluationPromptContext {
  snapshot: IContextSnapshot;
  delta: ISemanticDelta;
  blackboard: IBlackboardState;
  responsibilities: string[];
  role: string;
}

/** Everything a child needs to build a response prompt. */
export interface ResponsePromptContext {
  snapshot: IContextSnapshot;
  proposal: IAgentProposal;
  role: string;
}

/** Structured output of the evaluation LLM call, before novelty scoring. */
export interface ParsedEvaluation {
  proposal: IAgentProposal | null;
  blackboardEntries: IBlackboardEntry[];
}

// ---------------------------------------------------------------------------
// BaseAgent — shared evaluation pipeline for all stakeholder agents
// ---------------------------------------------------------------------------

/**
 * Implements the two-phase pipeline every agent follows:
 *
 *  **evaluate** (decide whether to intervene)
 *    1. Assemble prompt context from snapshot + delta + blackboard
 *    2. Build prompt via child hook          (buildEvaluationPrompt)
 *    3. Call LLM                             (callLLM)
 *    4. Parse raw text → structured data     (parseEvaluationOutput)
 *    5. Filter duplicate proposals           (filterByNovelty)
 *    6. Record proposal in history
 *    7. Return IAgentResult
 *
 *  **generateResponse** (speak after being granted the floor)
 *    1. Assemble prompt context from snapshot + proposal
 *    2. Build prompt via child hook          (buildResponsePrompt)
 *    3. Call LLM                             (callLLM)
 *    4. Parse raw text → structured response (parseResponseOutput)
 *    5. Return IAgentResponse
 *
 * Child classes override the four hook methods to provide domain-specific
 * prompts and output parsing.  Everything else stays in the base class.
 */
export abstract class BaseAgent implements IStakeholderAgent {
  abstract id: string;
  abstract role: string;
  abstract responsibilities: string[];

  private readonly scorer = new InterventionScorer();
  private proposalHistory: IAgentProposal[] = [];

  // =========================================================================
  // Public pipeline — do NOT override in child classes
  // =========================================================================

  /**
   * Phase 1 — Evaluate the current context and decide whether to propose
   * an intervention.  Returns the proposal (if any) plus blackboard entries
   * that other agents can read.
   */
  async evaluate(
    snapshot: IContextSnapshot,
    delta: ISemanticDelta,
    blackboard: IBlackboardState,
  ): Promise<IAgentResult> {
    try {
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

      // Step 3 — send the prompt to the LLM
      const raw = await this.callLLM(prompt);

      // Step 4 — parse the raw LLM response into structured data
      const parsed = this.parseEvaluationOutput(raw);

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
    snapshot: IContextSnapshot,
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

      // Step 3 — send the prompt to the LLM
      const raw = await this.callLLM(prompt);

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
   * Build the LLM prompt used during the evaluation phase.
   * Default implementation assembles a generic context prompt that lists
   * the agent's role, responsibilities, current context snapshot, delta,
   * and blackboard state.
   */
  protected buildEvaluationPrompt(ctx: EvaluationPromptContext): string {
    return [
      `You are a ${ctx.role} stakeholder in a meeting.`,
      `Your responsibilities: ${ctx.responsibilities.join(", ")}.`,
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
      "Decide whether to intervene.  Respond with JSON:",
      '{"proposal": {"agentId": "...", "content": "...", "urgency": 0.0-1.0} or null,',
      ' "blackboardEntries": [{"agentId": "...", "content": "..."}]}',
    ].join("\n");
  }

  /**
   * Build the LLM prompt used when generating a spoken response.
   * Default implementation provides the context and the proposal text.
   */
  protected buildResponsePrompt(ctx: ResponsePromptContext): string {
    return [
      `You are a ${ctx.role} stakeholder in a meeting.`,
      "",
      "## Current Context",
      this.formatSnapshot(ctx.snapshot),
      "",
      "## Proposal to Respond To",
      `Agent: ${ctx.proposal.agentId}`,
      `Content: ${ctx.proposal.content}`,
      `Urgency: ${ctx.proposal.urgency}`,
      "",
      "Respond with JSON:",
      '{"content": "...", "tone": "neutral"|"supportive"|"opposed"|"cautious"}',
    ].join("\n");
  }

  /**
   * Parse the raw LLM text from evaluate() into a ParsedEvaluation.
   * Default implementation extracts the first JSON object it finds
   * and coerces the fields into the correct shape.
   */
  protected parseEvaluationOutput(raw: string): ParsedEvaluation {
    const json = this.extractJson(raw);
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

    return { proposal, blackboardEntries };
  }

  /**
   * Parse the raw LLM text from generateResponse() into an IAgentResponse.
   * Default implementation extracts JSON and coerces the tone field.
   */
  protected parseResponseOutput(raw: string): IAgentResponse {
    const json = this.extractJson(raw);
    if (!json) {
      return { content: raw || "", tone: "neutral" };
    }

    const tone = this.isValidTone(json.tone) ? json.tone : "neutral";
    return { content: String(json.content ?? ""), tone };
  }

  /**
   * Send a prompt to the LLM and return the raw text output.
   * Override in child classes to wire up the actual Gemini / API client.
   */
  protected async callLLM(_prompt: string): Promise<string> {
    logger.warn("callLLM not implemented; returning empty response", {
      agentId: this.id,
    });
    return "";
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

  /**
   * Extracts a JSON object from LLM output that may be wrapped in
   * markdown code fences, surrounded by prose, or malformed.
   */
  private extractJson(raw: string): Record<string, unknown> | null {
    if (!raw) return null;

    // Attempt 1 — the entire output is valid JSON
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // continue to next attempt
    }

    // Attempt 2 — JSON inside a markdown code fence (```json ... ```)
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]) as Record<string, unknown>;
      } catch {
        // continue to next attempt
      }
    }

    // Attempt 3 — find the outermost { ... } brace pair
    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as Record<string, unknown>;
      } catch {
        // no valid JSON found
      }
    }

    return null;
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
  private formatSnapshot(snap: IContextSnapshot): string {
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
  private formatDelta(delta: ISemanticDelta): string {
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

  /** Format the blackboard state into a human-readable string for LLM prompts. */
  private formatBlackboard(blackboard: IBlackboardState): string {
    if (blackboard.length === 0) return "(Empty)";
    return blackboard
      .map((e) => `[${e.agentId}] ${e.content}`)
      .join("\n");
  }
}
