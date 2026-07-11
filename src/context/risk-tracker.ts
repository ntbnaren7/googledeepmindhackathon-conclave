import { ContextState, IRisk, Risk } from '../shared/types';

export class RiskTracker {
  track(state: ContextState, risks: readonly IRisk[], timestamp: number): boolean {
    let changed = false;

    for (const risk of risks) {
      changed = upsertRisk(state, risk, timestamp) || changed;
    }

    return changed;
  }
}

function upsertRisk(state: ContextState, risk: IRisk, timestamp: number): boolean {
  const existingIndex = state.risks.findIndex((candidate) => candidate.id === risk.id);
  const existing = existingIndex >= 0 ? state.risks[existingIndex] : null;
  const nextRisk: Risk = {
    id: risk.id,
    content: risk.description,
    severity: mapRiskSeverity(risk.severity),
    status: existing?.status ?? 'open',
    timestamp: existing?.timestamp ?? timestamp,
  };
  if (existing?.mitigation !== undefined) {
    nextRisk.mitigation = existing.mitigation;
  }

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
