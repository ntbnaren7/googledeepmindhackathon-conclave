import { WebSocketClient, type ConnectionMode } from './websocket-client';
import { AudioRecorder } from './audio-recorder';
import { AudioPlayer } from './audio-player';
import { Dispatcher } from './dispatcher';
import type { UIComponent, UIMessage } from './types';
import { AttentionBudgetGauge } from './components/attention-budget-gauge';
import { BlackboardPanel } from './components/blackboard-panel';
import { StakeholderPanel } from './components/stakeholder-panel';
import { TranscriptPanel } from './components/transcript-panel';
import { DecisionGraphPanel } from './components/decision-graph-panel';
import { InterruptQueue } from './components/interrupt-queue';
import { escapeHtml } from './agents';

/**
 * UI application entry point. Wires the WebSocket client (live backend, with
 * mock-feed fallback) to the panel components via the Dispatcher.
 */

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

/** Shows the current meeting topic as a chip in the header. */
class HeaderTopic implements UIComponent {
  readonly kinds = ['context'] as const;
  private el: HTMLElement | null = null;

  mount(root: HTMLElement): void {
    this.el = root;
  }

  handle(msg: UIMessage): void {
    if (msg.kind !== 'context' || !this.el) return;
    this.el.hidden = false;
    this.el.innerHTML = `Topic: <strong>${escapeHtml(msg.context.topic)}</strong>`;
  }

  clear(): void {
    if (this.el) {
      this.el.hidden = true;
      this.el.textContent = '';
    }
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
  dispatcher.register(new AttentionBudgetGauge(), byId('budget-body'));
  dispatcher.register(new StakeholderPanel(), byId('stakeholder-body'));
  dispatcher.register(new BlackboardPanel(), byId('blackboard-body'));
  dispatcher.register(new TranscriptPanel(), byId('transcript-body'));
  dispatcher.register(new DecisionGraphPanel(), byId('decision-body'));
  dispatcher.register(new InterruptQueue(), byId('interventions-body'));
  dispatcher.register(new HeaderTopic(), byId('topic-chip'));

  const statusEl = byId('conn-status');
  const audioPlayer = new AudioPlayer(24000);
  const client = new WebSocketClient({
    url: `ws://${location.hostname || 'localhost'}:3001`,
    mode,
    onMessage: (msg) => dispatcher.route(msg),
    onAudio: (buffer) => audioPlayer.enqueue(buffer),
    // When the model is cut off mid-sentence by user speech, immediately
    // stop all buffered audio so the user's voice can be heard.
    onInterrupt: () => audioPlayer.interrupt(),
    onStatus: (status) => {
      if (!statusEl) return;
      statusEl.textContent =
        status === 'live' ? 'live' : status === 'mock' ? 'mock feed' : 'connecting…';
    },
  });
  client.connect();

  const micBtn = byId('mic-btn') as HTMLButtonElement | null;
  const audioRecorder = new AudioRecorder((buffer) => client.sendAudio(buffer));

  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      if (audioRecorder.isRunning) {
        audioRecorder.stop();
        micBtn.textContent = '🎙️ Start Mic';
        micBtn.classList.remove('recording');
      } else {
        try {
          await audioRecorder.start();
          micBtn.textContent = '⏹ Stop Mic';
          micBtn.classList.add('recording');
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to start mic', err);
          alert('Could not access microphone.');
        }
      }
    });
  }
}

main();
