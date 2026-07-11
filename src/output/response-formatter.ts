import { IAgentProposal, IAgentResponse } from "@shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Output of the formatter — conversational text plus optional SSML. */
export interface FormattedResponse {
  /** Natural conversational text. */
  markdown: string;
  /** Optional SSML markup for speech synthesis. */
  ssml: string;
}

// ---------------------------------------------------------------------------
// ResponseFormatter
// ---------------------------------------------------------------------------

/**
 * Converts a structured IAgentProposal into natural conversational speech.
 *
 * Responsibilities:
 *   - Preserve the intent of the proposal
 *   - Remove robotic or templated phrasing
 *   - Produce concise, interruption-ready speech
 *   - Optionally generate SSML markup for speech synthesis
 *
 * This module performs formatting only.
 * It does not modify proposals or affect scoring.
 */
export class ResponseFormatter {
  /**
   * Format an agent proposal into conversational speech.
   *
   * Preserves the proposal's intent while cleaning up phrasing
   * for natural spoken delivery.
   */
  format(proposal: IAgentProposal): FormattedResponse {
    const cleaned = this.cleanContent(proposal.content);
    const speech = this.toSpeech(cleaned, proposal.urgency);
    const ssml = this.toSSML(speech);

    return { markdown: speech, ssml };
  }

  /**
   * Format an IAgentProposal into an IAgentResponse.
   *
   * Returns the standard response type consumed by the speech pipeline.
   */
  toAgentResponse(proposal: IAgentProposal): IAgentResponse {
    const formatted = this.format(proposal);
    const tone = this.inferTone(proposal.urgency);

    return { content: formatted.markdown, tone };
  }

  /**
   * Convert conversational text into SSML markup.
   *
   * Wraps text in `<speak>` tags with prosody hints based on urgency.
   */
  toSSML(text: string, urgency?: number): string {
    const rate = this.prosodyRate(urgency);
    const emphasis = urgency !== undefined && urgency >= 0.7 ? "strong" : "moderate";

    return [
      "<speak>",
      `<prosody rate="${rate}">`,
      `<emphasis level="${emphasis}">${this.escapeXml(text)}</emphasis>`,
      "</prosody>",
      "</speak>",
    ].join("");
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Clean raw proposal content into conversational text.
   * Removes markdown artifacts, collapses whitespace, trims filler.
   */
  private cleanContent(content: string): string {
    return content
      .replace(/#{1,6}\s*/g, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, ". ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /**
   * Transform cleaned content into speech-ready text.
   * Ensures the output is concise and interruption-ready.
   */
  private toSpeech(content: string, urgency: number): string {
    let text = content;

    if (urgency >= 0.7) {
      text = this.prependUrgencyMarker(text);
    }

    if (text.length > 200) {
      text = this.truncateToSentence(text, 200);
    }

    return text;
  }

  /**
   * Prepend an urgency marker for high-priority statements.
   */
  private prependUrgencyMarker(text: string): string {
    const lower = text.toLowerCase();
    if (
      lower.startsWith("important") ||
      lower.startsWith("critical") ||
      lower.startsWith("urgent")
    ) {
      return text;
    }
    return `Important: ${text}`;
  }

  /**
   * Truncate text to a maximum length, ending at a sentence boundary.
   */
  private truncateToSentence(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastPeriod > 0) {
      return truncated.slice(0, lastPeriod + 1);
    }
    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + ".";
    }
    return truncated + ".";
  }

  /**
   * Infer a tone from the proposal urgency.
   */
  private inferTone(urgency: number): IAgentResponse["tone"] {
    if (urgency >= 0.8) return "opposed";
    if (urgency >= 0.5) return "cautious";
    if (urgency >= 0.3) return "neutral";
    return "supportive";
  }

  /**
   * Map urgency to SSML prosody rate.
   */
  private prosodyRate(urgency?: number): string {
    if (urgency === undefined) return "medium";
    if (urgency >= 0.7) return "fast";
    if (urgency >= 0.4) return "medium";
    return "slow";
  }

  /**
   * Escape XML special characters for SSML.
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
