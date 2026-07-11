/**
 * Global type definitions for Conclave
 */

export interface Speaker {
  id: string;
  label: string;
  isHuman: boolean;
}

export interface ISemanticUnit {
  id: string;
  speakerId: string;
  content: string;
  timestamp: number;
}

export interface ITopic {
  id: string;
  label: string;
  confidence: number;
}

export interface IDecision {
  id: string;
  description: string;
  status: "proposed" | "approved" | "rejected";
  timestamp: number;
}

export interface IAssumption {
  id: string;
  statement: string;
  challenged: boolean;
}

export interface IRisk {
  id: string;
  description: string;
  severity: number;
}

export interface ISemanticDelta {
  units: ISemanticUnit[];
  topics: ITopic[];
  decisions: IDecision[];
  assumptions: IAssumption[];
  risks: IRisk[];
}

export interface IContextSnapshot {
  topics: ITopic[];
  decisions: IDecision[];
  assumptions: IAssumption[];
  risks: IRisk[];
  timestamp: number;
}

export interface IBlackboardEntry {
  agentId: string;
  content: string;
  timestamp: number;
}

export type IBlackboardState = IBlackboardEntry[];

export interface IAgentProposal {
  agentId: string;
  content: string;
  urgency: number;
}

export interface IAgentResult {
  proposal: IAgentProposal | null;
  blackboardEntries: IBlackboardEntry[];
}

export interface IAgentResponse {
  content: string;
  tone: "neutral" | "supportive" | "opposed" | "cautious";
}

export interface ISpeechToken {
  text: string;
  durationMs: number;
}

export type SemanticDelta = ISemanticDelta;
