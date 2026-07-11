/**
 * Global type definitions for Conclave
 */

export interface Speaker {
  id: string;
  label: string;
  isHuman: boolean;
}

export interface AgentSemanticUnit {
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

export interface AgentTopic {
  id: string;
  label: string;
  confidence: number;
}

export interface AgentDecision {
  id: string;
  description: string;
  status: 'proposed' | 'approved' | 'rejected';
  timestamp: number;
}

export interface AgentAssumption {
  id: string;
  statement: string;
  challenged: boolean;
}

export interface AgentRisk {
  id: string;
  description: string;
  severity: number;
}

export interface SemanticDelta {
  units: AgentSemanticUnit[];
  topics: AgentTopic[];
  decisions: AgentDecision[];
  assumptions: AgentAssumption[];
  risks: AgentRisk[];
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
  readonly id: string;
  readonly content: string;
  readonly stance: 'support' | 'oppose';
  readonly speakerId?: string;
  readonly sourceUnitId: string;
}

export interface DecisionNode {
  readonly id: string;
  readonly statement: string;
  readonly status: 'proposed' | 'decided' | 'rejected';
  readonly supporting: readonly Argument[];
  readonly opposing: readonly Argument[];
  readonly timestamp: number;
}

export interface Assumption {
  readonly id: string;
  readonly content: string;
  readonly status: 'active' | 'challenged' | 'validated' | 'invalidated';
  readonly sourceUnitId: string;
  readonly timestamp: number;
}

export interface Risk {
  readonly id: string;
  readonly content: string;
  readonly severity: 'low' | 'med' | 'high';
  readonly mitigation?: string;
  readonly status: 'open' | 'mitigated';
  readonly timestamp: number;
}

export interface Topic {
  readonly id: string;
  readonly title: string;
  readonly startedAtTimestamp: number;
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

export interface AgentContextSnapshot {
  topics: AgentTopic[];
  decisions: AgentDecision[];
  assumptions: AgentAssumption[];
  risks: AgentRisk[];
  timestamp: number;
}

export type IContextSnapshot = AgentContextSnapshot;
export type ISemanticDelta = SemanticDelta;

export interface IBlackboardEntry {
  agentId: string;
  content: string;
  timestamp: number;
  /** IDs of other blackboard entries this explicitly addresses (dialogue threading). */
  inReplyTo?: string[];
}

export type IBlackboardState = IBlackboardEntry[];

export interface IAgentProposal {
  agentId: string;
  content: string;
  urgency: number;
  /** The exact text from the transcript/delta that triggered this proposal. */
  triggerQuote?: string;
  /** One-sentence rationale for why this urgency level was chosen. */
  urgencyReason?: string;
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


export interface ArbitrationResult {
  granted: IAgentProposal | null;
  rejected: readonly IAgentProposal[];
  deferred: readonly IAgentProposal[];
}
