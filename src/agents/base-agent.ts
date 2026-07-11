import { IStakeholderAgent } from './interfaces';

export abstract class BaseAgent implements IStakeholderAgent {
  abstract id: string;
  abstract role: string;
  abstract responsibilities: string[];
  
  async evaluate(snapshot: any, delta: any, blackboard: any): Promise<any> {
    // TODO: call LLM, score, return AgentResult
    return { proposal: null, blackboardEntries: [] };
  }
  
  async generateResponse(snapshot: any, proposal: any): Promise<any> {
    return { content: '', tone: 'neutral' };
  }
  
  reset(): void {}
}
