import { ILlmClient } from './interfaces';

/**
 * Deterministic, network-free LLM client. Returns responses in the exact JSON
 * shapes the agents' default parsers expect, so the full cognitive loop can run
 * (and be unit-tested) without a Gemini key. Each evaluate() yields a proposal
 * plus a blackboard note; generateResponse() yields a short spoken line.
 */
export class MockLlmClient implements ILlmClient {
  constructor(private readonly urgency = 0.7) {}

  async generate(prompt: string): Promise<string> {
    // The evaluation prompt asks for a `blackboardEntries` array; the response
    // prompt asks for `{content, tone}`. Distinguish on that marker.
    if (prompt.includes('blackboardEntries')) {
      return JSON.stringify({
        proposal: {
          agentId: 'placeholder',
          content: 'This change affects our assumptions and deserves scrutiny.',
          urgency: this.urgency,
        },
        blackboardEntries: [
          { agentId: 'placeholder', content: 'Noting a relevant consideration for the group.' },
        ],
      });
    }

    return JSON.stringify({
      content: 'From my vantage point, this is the trade-off we should weigh carefully.',
      tone: 'cautious',
    });
  }
}
