import { IEventBus } from './interfaces';

export class EventBus implements IEventBus {
  publish(event: any): void {
    // TODO: implement
  }
  subscribe(type: string, handler: any): () => void {
    // TODO: implement
    return () => {};
  }
  subscribeAll(handler: any): () => void {
    // TODO: implement
    return () => {};
  }
}
