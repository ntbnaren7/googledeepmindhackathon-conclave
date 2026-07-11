import { IContextEngine } from './interfaces';

export class ContextEngine implements IContextEngine {
  constructor(private eventBus: any) {}
  initialize(config: any): void {}
  handleDelta(delta: any): void {}
  getSnapshot(): any {}
  getDecisionGraph(): any[] { return []; }
  reset(): void {}
}
