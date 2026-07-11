export interface IContextEngine {
  initialize(config: any): void;
  handleDelta(delta: any): void;
  getSnapshot(): any;
  getDecisionGraph(): any[];
  reset(): void;
}
