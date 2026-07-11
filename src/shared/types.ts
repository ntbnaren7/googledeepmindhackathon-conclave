// Perception & Semantic Compression
export interface Speaker {
  readonly id: string;
  readonly label: string;
  readonly isHuman: boolean;
}

export interface AudioChunk {
  readonly data: Uint8Array;
  readonly timestamp: number;
  readonly sampleRate: number;
}

export interface RawTranscript {
  readonly text: string;
  readonly speakerTag?: string;
  readonly confidence?: number;
  readonly isFinal: boolean;
  readonly startMs?: number;
  readonly endMs?: number;
}

export interface TranscriptSegment {
  readonly id: string;
  readonly speakerId: string;
  readonly speakerLabel: string;
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly confidence: number;
  readonly isFinal: boolean;
  readonly timestamp: number;
}

export interface PauseEvent {
  readonly type: 'brief' | 'natural' | 'extended';
  readonly durationMs: number;
  readonly timestamp: number;
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

export interface SemanticDelta {
  readonly id: string;
  readonly units: readonly SemanticUnit[];
  readonly topicShift: boolean;
  readonly newTopic: string | null;
  readonly timestamp: number;
}

// Context & Knowledge
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

export interface BlackboardEntry {
  readonly id: string;
  readonly agentId: string;
  readonly cycleId: string;
  readonly type:
    | 'observation'
    | 'warning'
    | 'hypothesis'
    | 'question'
    | 'confidence_update'
    | 'agreement'
    | 'disagreement';
  readonly content: string;
  readonly confidence: number;
  readonly relatedTo: string | null;
  readonly timestamp: number;
}

export interface BlackboardState {
  readonly entries: readonly BlackboardEntry[];
}

// Agents & Proposals
export interface InterventionProposal {
  readonly id: string;
  readonly agentId: string;
  readonly triggerEventId: string;
  readonly createdAt: number;
  readonly relevance: number;
  readonly severity: number;
  readonly confidence: number;
  readonly informationGain: number;
  readonly timeCriticality: number;
  readonly interruptCost: number;
  readonly urgency: number;
  readonly reason: string;
  readonly recommendation: string;
}

export interface AgentResult {
  readonly proposal: InterventionProposal | null;
  readonly blackboardEntries: readonly Omit<BlackboardEntry, 'id' | 'cycleId' | 'timestamp'>[];
}

export interface ArbitrationResult {
  readonly granted: InterventionProposal | null;
  readonly rejected: readonly InterventionProposal[];
  readonly deferred: readonly InterventionProposal[];
}
