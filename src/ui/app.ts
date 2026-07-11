import { WebSocketClient, type ConnectionMode } from './websocket-client';
import { Dispatcher } from './dispatcher';
import type { UIComponent, UIMessage } from './types';

/**
 * UI application entry point.
 *
 * Wires the WebSocket client (live backend, with mock-feed fallback) to the
 * panel components via the Dispatcher. Panel components are registered in
 * `main()`; Phase D4 adds the full set (budget gauge, blackboard, etc.).
 */

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Temporary D3 component: appends transcript lines as they arrive so the mock
 * feed is visibly flowing end-to-end. Replaced by `TranscriptPanel` in Phase D4.
 */
class TranscriptTail implements UIComponent {
  readonly kinds = ['transcript'] as const;
  private root: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    root.innerHTML = '';
    this.root = root;
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'transcript' || !this.root) return;
    const line = document.createElement('div');
    line.className = 'enter';
    line.style.marginBottom = '10px';
    line.innerHTML = `<strong style="color:var(--accent)">${escapeHtml(
      msg.line.speaker,
    )}</strong> <span style="color:var(--text-dim)">${escapeHtml(msg.line.text)}</span>`;
    this.root.appendChild(line);
    this.root.scrollTop = this.root.scrollHeight;
  }
}

function main(): void {
  const params = new URLSearchParams(location.search);
  const mode: ConnectionMode = params.has('mock')
    ? 'mock'
    : params.has('live')
      ? 'live'
      : 'auto';

  const dispatcher = new Dispatcher();

  // --- Panel registration (D4 fills this out) -------------------------------
  // dispatcher.register(new AttentionBudgetGauge(), byId('budget-body'));
  // dispatcher.register(new BlackboardPanel(), byId('blackboard-body'));
  dispatcher.register(new TranscriptTail(), byId('transcript-body'));

  // --- Connection -----------------------------------------------------------
  const statusEl = byId('conn-status');
  const client = new WebSocketClient({
    url: `ws://${location.hostname || 'localhost'}:3001`,
    mode,
    onMessage: (msg) => dispatcher.route(msg),
    onStatus: (status) => {
      if (!statusEl) return;
      statusEl.textContent =
        status === 'live' ? 'live' : status === 'mock' ? 'mock feed' : 'connecting…';
    },
  });
  client.connect();
}

main();
