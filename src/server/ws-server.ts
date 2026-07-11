import { WebSocketServer, WebSocket } from 'ws';
import type { IEventBus } from '../events/interfaces';
import type { IPerceptionEngine, IGeminiLiveConnector } from '../perception/interfaces';
import type { AgentLivePool } from '../perception/agent-live-pool';
import { EventType } from '../events/event-types';
import { logger } from '../shared/logger';

export interface ConclaveServerConfig {
  port: number;
  eventBus: IEventBus;
  perceptionEngine: IPerceptionEngine;
  /** The main Live connector — used to wire the interrupt signal to browsers. */
  connector: IGeminiLiveConnector;
  /** Optional agent pool — notified when user starts/stops speaking. */
  agentPool?: AgentLivePool;
}

export class ConclaveWebSocketServer {
  private wss: WebSocketServer | null = null;
  private readonly config: ConclaveServerConfig;
  private clients = new Set<WebSocket>();

  constructor(config: ConclaveServerConfig) {
    this.config = config;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.config.port });

    this.wss.on('connection', (ws) => {
      logger.info('[ws-server] Client connected');
      this.clients.add(ws);

      ws.on('message', (message, isBinary) => {
        if (isBinary) {
          // Audio chunk from the client UI
          // message is a Buffer which is a subclass of Uint8Array. We need its ArrayBuffer.
          const buffer = (message as Buffer).buffer;
          // Extract just the written bytes, since Buffer.buffer might represent a larger pool.
          const byteOffset = (message as Buffer).byteOffset;
          const length = (message as Buffer).byteLength;
          const slicedBuffer = buffer.slice(byteOffset, byteOffset + length) as ArrayBuffer;
          
          this.config.perceptionEngine.pushAudio({ 
            data: slicedBuffer,
            sampleRate: 16000,
            timestamp: Date.now()
          });
        }
      });

      ws.on('close', () => {
        logger.info('[ws-server] Client disconnected');
        this.clients.delete(ws);
      });
    });

    this.subscribeToBackendEvents();

    logger.info(`[ws-server] Listening on port ${this.config.port}`);
  }

  private subscribeToBackendEvents(): void {
    // Forward relevant events to connected clients
    this.config.eventBus.subscribe(EventType.DELTA_PRODUCED, (event) => {
      this.broadcast({
        type: event.type,
        payload: event.payload
      });
    });

    this.config.eventBus.subscribe(EventType.BLACKBOARD_UPDATED, (event) => {
      this.broadcast({
        type: event.type,
        payload: event.payload
      });
    });

    this.config.eventBus.subscribe(EventType.INTERRUPT_GRANTED, (event) => {
      this.broadcast({
        type: event.type,
        payload: event.payload
      });
    });

    // Audio responses from the model — forward as raw binary frames.
    this.config.eventBus.subscribe(EventType.AGENT_SPEAKING, (event) => {
      const buf = (event.payload as { audioBuffer?: ArrayBuffer }).audioBuffer;
      if (!buf || buf.byteLength === 0) return;
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          // Prefix with a 1-byte type tag (0x01 = audio) so the browser
          // can distinguish binary audio frames from JSON text frames.
          const tagged = new Uint8Array(1 + buf.byteLength);
          tagged[0] = 0x01;
          tagged.set(new Uint8Array(buf), 1);
          client.send(tagged);
        }
      }
    });

    // When the Live model is interrupted by user speech, tell the browser
    // to stop playing buffered audio immediately — and notify the agent pool
    // that the user is now speaking (so agents can apply the interrupt threshold).
    this.config.connector.onInterrupt(() => {
      logger.info('[ws-server] broadcasting agent_interrupted to clients');
      this.broadcast({ type: 'agent_interrupted' });
      // Signal pool: user is now speaking — agents can interrupt at HIGH/CRITICAL urgency
      this.config.agentPool?.notifyUserSpeaking(true);
    });

    // When user finishes speaking (turn complete from input transcription),
    // restore normal urgency threshold on the agent pool.
    this.config.connector.onTranscript((raw) => {
      if (raw.isFinal) {
        this.config.agentPool?.notifyUserSpeaking(false);
      }
    });
  }

  private broadcast(data: unknown): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
