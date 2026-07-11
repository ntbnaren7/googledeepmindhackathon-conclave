import { ICognitiveKernel } from './interfaces';

export class CognitiveKernel implements ICognitiveKernel {
  constructor(private deps: any) {}
  async start(config: any): Promise<void> {}
  async stop(): Promise<void> {}
  
  private async executeTick(event: any, delta: any) {
    // TODO: implement cognitive tick
  }
}
