import { ContextState, DecisionNode, IDecision } from '../shared/types';

export class DecisionTracker {
  track(state: ContextState, decisions: readonly IDecision[]): boolean {
    let changed = false;

    for (const decision of decisions) {
      changed = upsertDecision(state, decision) || changed;
    }

    return changed;
  }
}

function upsertDecision(state: ContextState, decision: IDecision): boolean {
  const existingIndex = state.decisions.findIndex(
    (candidate) => candidate.id === decision.id,
  );
  const existing = existingIndex >= 0 ? state.decisions[existingIndex] : null;
  const nextDecision: DecisionNode = {
    id: decision.id,
    statement: decision.description,
    status: mapDecisionStatus(decision.status),
    supporting: existing?.supporting ?? [],
    opposing: existing?.opposing ?? [],
    timestamp: decision.timestamp,
  };

  if (!existing) {
    state.decisions.push(nextDecision);
    return true;
  }

  if (decisionsEqual(existing, nextDecision)) return false;
  state.decisions[existingIndex] = nextDecision;
  return true;
}

function mapDecisionStatus(status: IDecision['status']): DecisionNode['status'] {
  if (status === 'approved') return 'decided';
  return status;
}

function decisionsEqual(left: DecisionNode, right: DecisionNode): boolean {
  return (
    left.id === right.id &&
    left.statement === right.statement &&
    left.status === right.status &&
    left.timestamp === right.timestamp &&
    left.supporting === right.supporting &&
    left.opposing === right.opposing
  );
}
