// Perception & Semantic Compression
export interface SemanticUnit {
  readonly type:
    | 'proposal'
    | 'decision'
    | 'assumption'
    | 'risk'
    | 'question'
    | 'objection'
    | 'clarification'
    | 'statement'
    | 'agreement';
  readonly content: string;
  readonly confidence: number;
  readonly domain: 'architecture' | 'product' | 'finance' | 'research' | null;
}

export interface SemanticDelta {
  readonly units: readonly SemanticUnit[];
  readonly topicShift: boolean;
  readonly newTopic: string | null;
}

// Context & Knowledge (Strict placeholder interfaces)
export interface Decision {}
export interface Assumption {}
export interface Risk {}

export interface ContextSnapshot {
  readonly id: string;
  readonly timestamp: number;
  readonly currentTopic: string;
  readonly topicHistory: readonly string[];
  readonly decisions: readonly Decision[];
  readonly assumptions: readonly Assumption[];
  readonly risks: readonly Risk[];
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
