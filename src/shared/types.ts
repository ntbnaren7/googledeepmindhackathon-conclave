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
  /**
   * Optional semantic role of the utterance. When the compressor tags a unit
   * as `objection` / `agreement`, the Context Engine links it as an
   * opposing / supporting argument on the best-matching decision. Absent units
   * are treated as plain `statement`s.
   */
  type?: SemanticUnitType;
}

export interface ITopic {
  id: string;
  label: string;
  confidence: number;
}

export interface IDecision {
  id: string;
  description: string;
  status: 'proposed' | 'approved' | 'rejected';
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

export type SemanticUnitType =
  | 'proposal'
  | 'decision'
  | 'assumption'
  | 'risk'
  | 'question'
  | 'objection'
  | 'clarification'
  | 'statement'
  | 'agreement';

export type Domain = 'architecture' | 'product' | 'finance' | 'research' | null;

export interface SemanticUnit {
  readonly id: string;
  readonly type: SemanticUnitType;
  readonly content: string;
  readonly confidence: number;
  readonly domain: Domain;
  readonly speakerId?: string;
  readonly timestamp: number;
}

export interface Argument {
  id: string;
  content: string;
  stance: 'support' | 'oppose';
  speakerId?: string;
  sourceUnitId: string;
}

export interface DecisionNode {
  id: string;
  statement: string;
  status: 'proposed' | 'decided' | 'rejected';
  supporting: Argument[];
  opposing: Argument[];
  timestamp: number;
}

export interface Assumption {
  id: string;
  content: string;
  status: 'active' | 'challenged' | 'validated' | 'invalidated';
  sourceUnitId: string;
  timestamp: number;
}

export interface Risk {
  id: string;
  content: string;
  severity: 'low' | 'med' | 'high';
  mitigation?: string;
  status: 'open' | 'mitigated';
  timestamp: number;
}

export interface Topic {
  id: string;
  title: string;
  startedAtTimestamp: number;
}

export interface ContextState {
  currentTopic: Topic | null;
  topicHistory: Topic[];
  decisions: DecisionNode[];
  assumptions: Assumption[];
  risks: Risk[];
  interventions: unknown[];
}

export interface ContextSnapshot {
  readonly id: string;
  readonly timestamp: number;
  readonly currentTopic: Topic | null;
  readonly topicHistory: readonly Topic[];
  readonly decisions: readonly DecisionNode[];
  readonly assumptions: readonly Assumption[];
  readonly risks: readonly Risk[];
  readonly interventions: readonly unknown[];
}

export interface KnowledgeEntry {
  id: string;
  type: SemanticUnitType;
  content: string;
  domain: Domain;
  speakerId?: string;
  timestamp: number;
}

export interface MeetingRecord {
  readonly topics: readonly Topic[];
  readonly decisions: readonly DecisionNode[];
  readonly assumptions: readonly Assumption[];
  readonly risks: readonly Risk[];
  readonly interventions: readonly unknown[];
  readonly generatedAt: number;
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
  tone: 'neutral' | 'supportive' | 'opposed' | 'cautious';
}

export interface ISpeechToken {
  text: string;
  durationMs: number;
}

export type SemanticDelta = ISemanticDelta;

export interface ArbitrationResult {
  granted: IAgentProposal | null;
  rejected: readonly IAgentProposal[];
  deferred: readonly IAgentProposal[];
}
