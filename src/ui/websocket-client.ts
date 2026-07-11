import type { UIMessage, ContextView } from './types';
import { MockFeed, type FeedListener } from './mock-feed';

export type ConnectionMode = 'auto' | 'live' | 'mock';

export interface WebSocketClientOptions {
  url: string;
  mode?: ConnectionMode;
  onMessage: FeedListener;
  /** Optional status callback: 'live' | 'mock' | 'connecting'. */
  onStatus?: (status: 'live' | 'mock' | 'connecting') => void;
}

/**
 * Receives backend events over WebSocket and normalizes them into UIMessages.
 * Falls back to the scripted MockFeed when the socket is unavailable or when
 * mode is 'mock', so the UI is always demoable. In 'auto' (default) it tries the
 * live socket and switches to the mock feed if the connection fails.
 */
export class WebSocketClient {
  private readonly url: string;
  private readonly mode: ConnectionMode;
  private readonly onMessage: FeedListener;
  private readonly onStatus?: WebSocketClientOptions['onStatus'];
  private socket: WebSocket | null = null;
  private mockFeed: MockFeed | null = null;

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.mode = options.mode ?? 'auto';
    this.onMessage = options.onMessage;
    this.onStatus = options.onStatus;
  }

  connect(): void {
    if (this.mode === 'mock') {
      this.startMock();
      return;
    }
    this.onStatus?.('connecting');
    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.fallbackToMock();
      return;
    }

    this.socket.addEventListener('open', () => this.onStatus?.('live'));
    this.socket.addEventListener('message', (ev) => this.handleRaw(ev.data));
    this.socket.addEventListener('error', () => this.handleSocketDown());
    this.socket.addEventListener('close', () => this.handleSocketDown());
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.mockFeed?.stop();
    this.mockFeed = null;
  }

  private handleSocketDown(): void {
    if (this.mode === 'live') return; // caller insists on live; don't mask it
    if (!this.mockFeed) this.fallbackToMock();
  }

  private fallbackToMock(): void {
    // eslint-disable-next-line no-console
    console.warn('[ws] live socket unavailable — using mock feed');
    this.startMock();
  }

  private startMock(): void {
    this.onStatus?.('mock');
    this.mockFeed = new MockFeed({ loop: true });
    this.mockFeed.start(this.onMessage);
  }

  private handleRaw(data: unknown): void {
    if (typeof data !== 'string') return;
    let event: { type?: string; payload?: unknown };
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    for (const msg of this.translate(event)) this.onMessage(msg);
  }

  /**
   * Maps a backend typed event to zero or more UIMessages. Most backend payloads
   * are still empty (see Dev A payload dependency), so only DELTA_PRODUCED is
   * mapped today. Extend the cases as Dev A enriches EventPayloadMap:
   *   TRANSCRIPT_UPDATE -> { kind: 'transcript' }
   *   BLACKBOARD_UPDATED -> { kind: 'blackboard' }
   *   CYCLE_COMPLETED / INTERRUPT_GRANTED -> budget / intervention / stakeholder
   */
  private translate(event: { type?: string; payload?: unknown }): UIMessage[] {
    switch (event.type) {
      case 'delta.produced': {
        const delta = (event.payload as { delta?: DeltaShape })?.delta;
        if (!delta) return [];
        const context: ContextView = {
          topic: delta.topics?.[0]?.label ?? 'Discussion',
          assumptions: (delta.assumptions ?? []).map((a) => a.statement),
          decisions: (delta.decisions ?? []).map((d) => d.description),
          risks: (delta.risks ?? []).map((r) => r.description),
        };
        return [{ kind: 'context', context }];
      }
      default:
        return [];
    }
  }
}

/** Minimal structural view of the backend SemanticDelta used for translation. */
interface DeltaShape {
  topics?: { label: string }[];
  assumptions?: { statement: string }[];
  decisions?: { description: string }[];
  risks?: { description: string }[];
}
