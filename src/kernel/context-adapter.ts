import { ContextSnapshot, AgentContextSnapshot, AgentTopic, AgentDecision, AgentAssumption, AgentRisk } from '../shared/types';

export function adaptContextSnapshot(snap: ContextSnapshot): AgentContextSnapshot {
  const allTopics = snap.currentTopic 
    ? [...snap.topicHistory, snap.currentTopic] 
    : [...snap.topicHistory];

  return {
    timestamp: snap.timestamp,
    topics: allTopics.map(t => ({
      id: t.id,
      label: t.title,
      confidence: 1.0 // Explicit confidence not stored in canonical Topic
    })),
    decisions: snap.decisions.map(d => ({
      id: d.id,
      description: d.statement,
      // Map 'decided' to 'approved' for the agent DTO
      status: d.status === 'decided' ? 'approved' : d.status,
      timestamp: d.timestamp
    })),
    assumptions: snap.assumptions.map(a => ({
      id: a.id,
      statement: a.content,
      challenged: a.status === 'challenged' || a.status === 'invalidated'
    })),
    risks: snap.risks.map(r => ({
      id: r.id,
      description: r.content,
      severity: r.severity === 'high' ? 3 : r.severity === 'med' ? 2 : 1
    }))
  };
}
