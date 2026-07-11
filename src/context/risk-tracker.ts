import { ContextState, AgentRisk, Risk } from '../shared/types';
import { bestMatchIndex } from './matcher';

export class RiskTracker {
  track(state: ContextState, risks: readonly AgentRisk[], timestamp: number): boolean {
    let changed = false;

    for (const risk of risks) {
      changed = upsertRisk(state, risk, timestamp) || changed;
    }

    return changed;
  }
}

function findRiskIndex(state: ContextState, risk: AgentRisk): number {
  const byId = state.risks.findIndex((candidate) => candidate.id === risk.id);
  if (byId >= 0) return byId;
  return bestMatchIndex(risk.description, state.risks, (r) => r.content);
}

function upsertRisk(state: ContextState, risk: AgentRisk, timestamp: number): boolean {
  const existingIndex = findRiskIndex(state, risk);
  const existing = existingIndex >= 0 ? state.risks[existingIndex] : null;
  const nextRisk: Risk = {
    id: existing?.id ?? risk.id,
    content: existing?.content ?? risk.description,
    severity: mapRiskSeverity(risk.severity),
    status: 'open',
    timestamp: existing?.timestamp ?? timestamp,
    mitigation: existing?.mitigation,
  };

  if (!existing) {
    state.risks.push(nextRisk);
    return true;
  }

  if (risksEqual(existing, nextRisk)) return false;
  state.risks[existingIndex] = nextRisk;
  return true;
}

function mapRiskSeverity(severity: number): Risk['severity'] {
  if (severity < 0.34) return 'low';
  if (severity < 0.67) return 'med';
  return 'high';
}

function risksEqual(left: Risk, right: Risk): boolean {
  return (
    left.id === right.id &&
    left.content === right.content &&
    left.severity === right.severity &&
    left.mitigation === right.mitigation &&
    left.status === right.status &&
    left.timestamp === right.timestamp
  );
}
