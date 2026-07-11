import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, UIMessage } from './types';
import { logger } from '../shared/logger';

/**
 * Broadcasts normalized `UIMessage`s to every connected browser and forwards
 * inbound `ClientMessage`s (e.g. a typed/spoken utterance) to a handler. The
 * Orchestrator translates backend cognition into outbound messages, so the
 * server is a thin fan-out with no domain logic. New clients receive a `reset`.
 */
export class UiWebSocketServer {
  private readonly wss: WebSocketServer;
  private inboundHandler: ((message: ClientMessage) => void) | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (socket) => {
      logger.info('[ws-server] client connected');
      this.send(socket, { kind: 'reset' });
      socket.on('message', (raw) => this.handleInbound(raw.toString()));
    });
    this.wss.on('error', (error) => logger.error('[ws-server] error', { error: String(error) }));
    logger.info('[ws-server] listening', { port });
  }

  /** Register a handler for messages sent by the browser (e.g. `say`). */
  onInbound(handler: (message: ClientMessage) => void): void {
    this.inboundHandler = handler;
  }

  broadcast(message: UIMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  close(): void {
    this.wss.close();
  }

  private handleInbound(raw: string): void {
    if (this.inboundHandler === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (isSayMessage(parsed)) this.inboundHandler(parsed);
  }

  private send(socket: WebSocket, message: UIMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}

function isSayMessage(value: unknown): value is ClientMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'say' &&
    typeof (value as { speaker?: unknown }).speaker === 'string' &&
    typeof (value as { text?: unknown }).text === 'string'
  );
}
