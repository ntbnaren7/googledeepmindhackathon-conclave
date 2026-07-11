import { Assumption, ContextState, IAssumption } from '../shared/types';

export class AssumptionTracker {
  track(
    state: ContextState,
    assumptions: readonly IAssumption[],
    timestamp: number,
  ): boolean {
    let changed = false;

    for (const assumption of assumptions) {
      changed = upsertAssumption(state, assumption, timestamp) || changed;
    }

    return changed;
  }
}

function upsertAssumption(
  state: ContextState,
  assumption: IAssumption,
  timestamp: number,
): boolean {
  const existingIndex = state.assumptions.findIndex(
    (candidate) => candidate.id === assumption.id,
  );
  const existing = existingIndex >= 0 ? state.assumptions[existingIndex] : null;
  const nextAssumption: Assumption = {
    id: assumption.id,
    content: assumption.statement,
    status: assumption.challenged ? 'challenged' : existing?.status ?? 'active',
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

function assumptionsEqual(left: Assumption, right: Assumption): boolean {
  return (
    left.id === right.id &&
    left.content === right.content &&
    left.status === right.status &&
    left.sourceUnitId === right.sourceUnitId &&
    left.timestamp === right.timestamp
  );
}
