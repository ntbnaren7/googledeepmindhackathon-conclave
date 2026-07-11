import {
  ContextSnapshot,
  IAssumption,
  IContextSnapshot,
  IDecision,
  IRisk,
  ITopic,
} from '../shared/types';

/**
 * Adapts Dev B's rich `ContextSnapshot` (currentTopic/topicHistory, DecisionNode
 * with arguments, string severities) into the flat `IContextSnapshot` shape the
 * stakeholder agents consume. This is the impedance-matching seam between the
 * Context track and the Agents track.
 */
export function toIContextSnapshot(snapshot: ContextSnapshot): IContextSnapshot {
  const topics: ITopic[] = snapshot.topicHistory.map(toITopic);
  if (snapshot.currentTopic) topics.push(toITopic(snapshot.currentTopic));

  const decisions: IDecision[] = snapshot.decisions.map((d) => ({
    id: d.id,
    description: d.statement,
    status: d.status === 'decided' ? 'approved' : d.status === 'rejected' ? 'rejected' : 'proposed',
    timestamp: d.timestamp,
  }));

  const assumptions: IAssumption[] = snapshot.assumptions.map((a) => ({
    id: a.id,
    statement: a.content,
    challenged: a.status === 'challenged',
  }));

  const risks: IRisk[] = snapshot.risks.map((r) => ({
    id: r.id,
    description: r.content,
    severity: r.severity === 'high' ? 0.85 : r.severity === 'med' ? 0.5 : 0.2,
  }));

  return { topics, decisions, assumptions, risks, timestamp: snapshot.timestamp };
}

function toITopic(topic: { id: string; title: string }): ITopic {
  return { id: topic.id, label: topic.title, confidence: 1 };
}
