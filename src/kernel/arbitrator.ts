export class Arbitrator {
  constructor(private budget: any) {}
  evaluate(proposals: any[], blackboard: any) {
    // TODO: apply 7 arbitration rules
    return { granted: null, rejected: [], deferred: [] };
  }
}
