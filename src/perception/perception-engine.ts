import { IPerceptionEngine } from './interfaces';

export class PerceptionEngine implements IPerceptionEngine {
  constructor(private deps: any) {}
  async start(config: any): Promise<void> {}
  async stop(): Promise<void> {}
}
