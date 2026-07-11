import { Assumption, ContextState, AgentAssumption } from '../shared/types';
import { bestMatchIndex } from './matcher';

export class AssumptionTracker {
  track(state: ContextState, assumptions: readonly AgentAssumption[], timestamp: number): boolean {
    let changed = false;

    for (const assumption of assumptions) {
      changed = upsertAssumption(state, assumption, timestamp) || changed;
    }

    return changed;
  }
}

function upsertAssumption(
  state: ContextState,
  assumption: AgentAssumption,
  timestamp: number,
): boolean {
  const existingIndex = findAssumptionIndex(state, assumption);
  const existing = existingIndex >= 0 ? state.assumptions[existingIndex] : null;
  const nextAssumption: Assumption = {
    id: existing?.id ?? assumption.id,
    content: existing?.content ?? assumption.statement,
    status: assumption.challenged ? 'challenged' : (existing?.status ?? 'active'),
    sourceUnitId: existing?.sourceUnitId ?? assumption.id,
    timestamp: existing?.timestamp ?? timestamp,
  };

  if (!existing) {
    state.assumptions.push(nextAssumption);
    return true;
  }

  if (assumptionsEqual(existing, nextAssumption)) return false;
  state.assumptions[existingIndex] = nextAssumption;
  return true;
}

function findAssumptionIndex(state: ContextState, assumption: AgentAssumption): number {
  const byId = state.assumptions.findIndex((candidate) => candidate.id === assumption.id);
  if (byId >= 0) return byId;
  return bestMatchIndex(assumption.statement, state.assumptions, (a) => a.content);
}

function assumptionsEqual(left: Assumption, right: Assumption): boolean {
  return (
    left.id === right.id &&
    left.content === right.content &&
    left.status === right.status &&
    left.sourceUnitId === right.sourceUnitId &&
    left.timestamp === right.timestamp
  );
}
