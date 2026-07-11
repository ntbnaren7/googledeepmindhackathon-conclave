export interface IEventBus {
  publish<T>(event: any): void; // TODO: type strongly with TypedEvent
  subscribe<T>(type: string, handler: any): () => void;
  subscribeAll(handler: any): () => void;
}
