import { WebSocketServer, WebSocket } from 'ws';
import type { UIMessage } from './types';
import { logger } from '../shared/logger';

/**
 * Broadcasts normalized `UIMessage`s to every connected browser. The
 * Orchestrator translates backend cognition into these messages, so the server
 * is a thin fan-out: no domain logic lives here. New clients receive a `reset`
 * so their panels start from a clean slate.
 */
export class UiWebSocketServer {
  private readonly wss: WebSocketServer;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (socket) => {
      logger.info('[ws-server] client connected');
      this.send(socket, { kind: 'reset' });
    });
    this.wss.on('error', (error) => logger.error('[ws-server] error', { error: String(error) }));
    logger.info('[ws-server] listening', { port });
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

  private send(socket: WebSocket, message: UIMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}
