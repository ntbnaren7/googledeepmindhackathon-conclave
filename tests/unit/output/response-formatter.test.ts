import { describe, expect, it } from "vitest";
import { ResponseFormatter } from "../../../src/output/response-formatter";
import { IAgentProposal } from "../../../src/shared/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function proposal(content: string, urgency: number): IAgentProposal {
  return { agentId: "cto", content, urgency };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResponseFormatter", () => {
  describe("format", () => {
    it("returns markdown and ssml fields", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("Test content", 0.5));

      expect(result).toHaveProperty("markdown");
      expect(result).toHaveProperty("ssml");
    });

    it("strips markdown headers", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("# Important Decision", 0.5));

      expect(result.markdown).not.toContain("#");
      expect(result.markdown).toContain("Important Decision");
    });

    it("strips bold markers", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("**Critical** issue", 0.5));

      expect(result.markdown).not.toContain("**");
      expect(result.markdown).toContain("Critical issue");
    });

    it("strips inline code", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("Use `PostgreSQL` for DB", 0.5));

      expect(result.markdown).not.toContain("`");
      expect(result.markdown).toContain("PostgreSQL");
    });

    it("strips markdown links", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("See [docs](https://example.com)", 0.5));

      expect(result.markdown).toContain("docs");
      expect(result.markdown).not.toContain("https://");
    });

    it("collapses multiple newlines", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("Line one\n\n\nLine two", 0.5));

      expect(result.markdown).not.toContain("\n\n");
    });

    it("prepends urgency marker for high urgency", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("Database needs attention", 0.8));

      expect(result.markdown).toMatch(/^Important: /);
    });

    it("does not prepend marker if already urgent", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.format(proposal("Critical security issue", 0.9));

      expect(result.markdown).toMatch(/^Critical/);
      expect(result.markdown).not.toContain("Important: Critical");
    });

    it("truncates long content at sentence boundary", () => {
      const formatter = new ResponseFormatter();
      const longContent = "This is sentence one. " + "Word ".repeat(50);
      const result = formatter.format(proposal(longContent, 0.5));

      expect(result.markdown.length).toBeLessThanOrEqual(201);
      expect(result.markdown).toMatch(/\.$/);
    });
  });

  describe("toAgentResponse", () => {
    it("returns content and tone", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.toAgentResponse(proposal("Test", 0.5));

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("tone");
    });

    it("infers opposed tone for high urgency", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.toAgentResponse(proposal("Test", 0.9));

      expect(result.tone).toBe("opposed");
    });

    it("infers cautious tone for medium urgency", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.toAgentResponse(proposal("Test", 0.6));

      expect(result.tone).toBe("cautious");
    });

    it("infers neutral tone for moderate urgency", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.toAgentResponse(proposal("Test", 0.4));

      expect(result.tone).toBe("neutral");
    });

    it("infers supportive tone for low urgency", () => {
      const formatter = new ResponseFormatter();
      const result = formatter.toAgentResponse(proposal("Test", 0.1));

      expect(result.tone).toBe("supportive");
    });
  });

  describe("toSSML", () => {
    it("wraps in speak tags", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Hello world");

      expect(ssml).toContain("<speak>");
      expect(ssml).toContain("</speak>");
    });

    it("includes prosody element", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Hello", 0.5);

      expect(ssml).toContain("<prosody");
      expect(ssml).toContain("</prosody>");
    });

    it("uses fast rate for high urgency", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Urgent", 0.8);

      expect(ssml).toContain('rate="fast"');
    });

    it("uses slow rate for low urgency", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Relaxed", 0.1);

      expect(ssml).toContain('rate="slow"');
    });

    it("escapes XML characters", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Use <div> & \"quotes\"");

      expect(ssml).toContain("&lt;");
      expect(ssml).toContain("&amp;");
      expect(ssml).toContain("&quot;");
    });

    it("uses strong emphasis for high urgency", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Critical", 0.9);

      expect(ssml).toContain('level="strong"');
    });

    it("uses moderate emphasis for low urgency", () => {
      const formatter = new ResponseFormatter();
      const ssml = formatter.toSSML("Normal", 0.3);

      expect(ssml).toContain('level="moderate"');
    });
  });
});
