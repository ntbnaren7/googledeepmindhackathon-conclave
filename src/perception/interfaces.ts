export interface IPerceptionEngine {
  start(config: any): Promise<void>;
  stop(): Promise<void>;
}
