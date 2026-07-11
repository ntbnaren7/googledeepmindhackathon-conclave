import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentProposal,
  IAgentResponse,
} from "@shared/types";
import { ILlmClient } from "@agents/interfaces";

// ---------------------------------------------------------------------------
// Mock LLM Client
// ---------------------------------------------------------------------------

export class MockLlmClient implements ILlmClient {
  responses: string[];
  prompts: string[] = [];
  callCount = 0;

  constructor(responses: string[] = []) {
    this.responses = [...responses];
  }

  async generate(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    this.callCount++;
    return this.responses.shift() ?? "";
  }
}

export function createMockLlm(responses: string[] = []): MockLlmClient {
  return new MockLlmClient(responses);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const emptySnapshot: IContextSnapshot = {
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
  timestamp: 1000,
};

export const emptyDelta: ISemanticDelta = {
  units: [],
  topics: [],
  decisions: [],
  assumptions: [],
  risks: [],
};

export const emptyBlackboard: IBlackboardState = [];

export const snapshotWithTopics: IContextSnapshot = {
  topics: [{ id: "t1", label: "Database migration", confidence: 0.9 }],
  decisions: [{ id: "d1", description: "Use PostgreSQL", status: "proposed", timestamp: 1000 }],
  assumptions: [{ id: "a1", statement: "Team has capacity", challenged: false }],
  risks: [{ id: "r1", description: "Data loss risk", severity: 0.8 }],
  timestamp: 1000,
};

export const deltaWithContent: ISemanticDelta = {
  units: [{ id: "u1", speakerId: "s1", content: "We need to decide on the database", timestamp: 1000 }],
  topics: [{ id: "t1", label: "Database choice", confidence: 0.85 }],
  decisions: [{ id: "d1", description: "Migrate to PostgreSQL", status: "proposed", timestamp: 1000 }],
  assumptions: [{ id: "a1", statement: "Migration is safe", challenged: false }],
  risks: [{ id: "r1", description: "Potential downtime", severity: 0.7 }],
};

export const blackboardWithEntries: IBlackboardState = [
  { agentId: "cto", content: "Architecture review needed", timestamp: 1000 },
  { agentId: "product", content: "User impact assessment pending", timestamp: 1000 },
];

// ---------------------------------------------------------------------------
// Agent test helpers
// ---------------------------------------------------------------------------

export function validProposalResponse(agentId: string): string {
  return JSON.stringify({
    proposal: {
      agentId,
      content: "This is a valid proposal from the agent",
      urgency: 0.6,
    },
    blackboardEntries: [{ content: "Observation from agent" }],
  });
}

export function nullProposalResponse(): string {
  return JSON.stringify({
    proposal: null,
    blackboardEntries: [],
  });
}

export function validSpeechResponse(): string {
  return JSON.stringify({
    content: "This is a valid spoken response",
    tone: "neutral",
  });
}

export function parseProposalFromResult(result: { proposal: IAgentProposal | null }): IAgentProposal {
  if (!result.proposal) throw new Error("Expected proposal but got null");
  return result.proposal;
}

export function parseResponseFromResult(result: IAgentResponse): IAgentResponse {
  return result;
}
