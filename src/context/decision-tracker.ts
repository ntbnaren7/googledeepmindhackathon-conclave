import { ContextState, DecisionNode, AgentDecision } from '../shared/types';
import { bestMatchIndex } from './matcher';

export class DecisionTracker {
  track(state: ContextState, decisions: readonly AgentDecision[]): boolean {
    let changed = false;

    for (const decision of decisions) {
      changed = upsertDecision(state, decision) || changed;
    }

    return changed;
  }
}

function findDecisionIndex(state: ContextState, decision: AgentDecision): number {
  const byId = state.decisions.findIndex((candidate) => candidate.id === decision.id);
  if (byId >= 0) return byId;
  // Fall back to content similarity so a re-worded decision with a fresh id
  // updates the existing node instead of accumulating a duplicate.
  return bestMatchIndex(decision.description, state.decisions, (d) => d.statement);
}

function upsertDecision(state: ContextState, decision: AgentDecision): boolean {
  const existingIndex = findDecisionIndex(state, decision);
  const existing = existingIndex >= 0 ? state.decisions[existingIndex] : null;
  const nextDecision: DecisionNode = {
    id: existing?.id ?? decision.id,
    statement: existing?.statement ?? decision.description,
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

function mapDecisionStatus(status: AgentDecision['status']): DecisionNode['status'] {
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
