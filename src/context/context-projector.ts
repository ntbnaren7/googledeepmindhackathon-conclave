import { ContextSnapshot, ContextState } from '../shared/types';
import { generateId } from '../shared/id-generator';
import { IContextProjector } from './interfaces';

export class ContextProjector implements IContextProjector {
  project(state: ContextState): ContextSnapshot {
    const clone = structuredClone(state) as ContextState;

    return {
      ...clone,
      id: generateId(),
      timestamp: Date.now(),
    };
  }
}
