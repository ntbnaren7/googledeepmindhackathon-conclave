export class AttentionBudget {
  constructor(config: any) {}
  canInterrupt(): boolean { return true; }
  consume(cost: number) {}
  replenish(elapsed: number) {}
}
