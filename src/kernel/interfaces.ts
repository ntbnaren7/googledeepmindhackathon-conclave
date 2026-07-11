export interface ICognitiveKernel {
  start(config: any): Promise<void>;
  stop(): Promise<void>;
}
