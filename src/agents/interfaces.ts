export interface IStakeholderAgent {
  readonly id: string;
  readonly role: string;
  readonly responsibilities: string[];
  evaluate(snapshot: any, delta: any, blackboard: any): Promise<any>;
  generateResponse(snapshot: any, proposal: any): Promise<any>;
  reset(): void;
}
