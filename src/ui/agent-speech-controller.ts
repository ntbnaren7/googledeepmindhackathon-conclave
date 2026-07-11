import type { UIComponent, UIMessage, AgentId } from './types';
import { AGENT_META, agentColor } from './agents';

/**
 * Voice profiles per agent — distinct pitch & rate so each agent sounds
 * recognisably different during a demo. Falls back to browser default voice.
 */
const VOICE_PROFILES: Record<AgentId, { pitch: number; rate: number }> = {
  cto: { pitch: 0.9, rate: 1.05 },
  product: { pitch: 1.15, rate: 1.0 },
  finance: { pitch: 0.8, rate: 0.95 },
  research: { pitch: 1.05, rate: 0.9 },
};

/**
 * Browser-side TTS controller for agent speech with live interruption
 * detection. Subscribes to:
 *   - `agent-speak`  → start reading the agent's text aloud
 *   - `transcript`   → a human is speaking/typing → interrupt
 *
 * Also monitors direct user input (keystrokes on the text box and mic button
 * clicks) so interruptions are caught immediately — even before the backend
 * round-trips the transcript message back. The backend processes deltas
 * sequentially, so relying only on `transcript` messages would miss
 * interruptions that happen while a cycle is in-flight.
 *
 * Uses the Web Speech API (`window.speechSynthesis`). On browsers without it
 * the component mounts silently with no side-effects.
 */
export class AgentSpeechController implements UIComponent {
  readonly kinds = ['agent-speak', 'transcript'] as const;

  private speaking = false;
  private currentAgent: AgentId | null = null;
  private overlay: HTMLElement | null = null;

  // ── UIComponent lifecycle ──────────────────────────────────────────────

  mount(_root: HTMLElement): void {
    // Create a floating overlay that shows which agent is speaking.
    this.overlay = document.createElement('div');
    this.overlay.className = 'agent-speech-overlay hidden';
    this.overlay.id = 'agent-speech-overlay';
    this.overlay.innerHTML = `
      <div class="speech-indicator">
        <div class="speech-wave"><span></span><span></span><span></span><span></span><span></span></div>
        <span class="speech-label" id="speech-label"></span>
        <button class="speech-stop-btn" id="speech-stop-btn" title="Stop speaking">✕</button>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Manual stop button
    this.overlay.querySelector('#speech-stop-btn')?.addEventListener('click', () => {
      this.interruptSpeech('manual');
    });

    // ── Direct input monitoring ──────────────────────────────────────────
    // These fire instantly in the browser, before the backend round-trip.

    // Typing in the text input box
    const textInput = document.getElementById('ib-text');
    if (textInput) {
      textInput.addEventListener('keydown', () => {
        if (this.speaking) this.interruptSpeech('human');
      });
    }

    // Clicking the Send button
    const sendBtn = document.getElementById('ib-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        if (this.speaking) this.interruptSpeech('human');
      });
    }

    // Clicking the Mic button (user is about to speak)
    const micBtn = document.getElementById('ib-mic');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (this.speaking) this.interruptSpeech('human');
      });
    }
  }

  handle(msg: UIMessage): void {
    if (msg.kind === 'agent-speak') {
      this.startSpeaking(msg.agent, msg.text);
    } else if (msg.kind === 'transcript') {
      // A human is speaking/typing — interrupt the agent if it's talking.
      // This is the fallback path (after backend round-trip). The direct
      // input listeners above catch it faster, but this ensures we don't
      // miss edge cases.
      if (this.speaking) {
        this.interruptSpeech('human');
      }
    }
  }

  clear(): void {
    this.interruptSpeech('reset');
  }

  // ── Speech logic ───────────────────────────────────────────────────────

  private startSpeaking(agent: AgentId, text: string): void {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel anything currently playing.
    window.speechSynthesis.cancel();

    const profile = VOICE_PROFILES[agent];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Try to pick a voice (prefer Google voices for quality, then any English).
    // Voices may load asynchronously; if none yet, we proceed with the default.
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && v.name.includes('Google'),
    );
    const fallback = voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    else if (fallback) utterance.voice = fallback;

    this.speaking = true;
    this.currentAgent = agent;
    this.showOverlay(agent);
    this.setAgentCardSpeaking(agent, true);

    utterance.onend = () => this.onSpeechFinished();
    utterance.onerror = () => this.onSpeechFinished();

    window.speechSynthesis.speak(utterance);

    // Chrome bug workaround: speechSynthesis can pause after ~15 seconds.
    // Resume periodically to keep it alive.
    this.startKeepAlive();
  }

  private interruptSpeech(reason: 'human' | 'manual' | 'reset'): void {
    if (!this.speaking) return;

    this.stopKeepAlive();
    window.speechSynthesis?.cancel();
    const agent = this.currentAgent;
    this.speaking = false;
    this.currentAgent = null;
    this.hideOverlay();

    if (agent) {
      this.setAgentCardSpeaking(agent, false);
      if (reason === 'human' || reason === 'manual') {
        this.flashInterrupted(agent);
      }
    }
  }

  private onSpeechFinished(): void {
    if (!this.speaking) return; // already interrupted
    this.stopKeepAlive();
    const agent = this.currentAgent;
    this.speaking = false;
    this.currentAgent = null;
    this.hideOverlay();
    if (agent) this.setAgentCardSpeaking(agent, false);
  }

  // ── Chrome keep-alive workaround ───────────────────────────────────────
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // ── Visual helpers ─────────────────────────────────────────────────────

  private showOverlay(agent: AgentId): void {
    if (!this.overlay) return;
    const label = this.overlay.querySelector('#speech-label');
    if (label) label.textContent = `${AGENT_META[agent].name} is speaking…`;
    this.overlay.style.setProperty('--agent', agentColor(agent));
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlay?.classList.add('hidden');
  }

  /** Add a pulsing glow to the agent's card while speaking. */
  private setAgentCardSpeaking(agent: AgentId, isSpeaking: boolean): void {
    const card = document.getElementById(`agent-${agent}`);
    if (!card) return;
    if (isSpeaking) {
      card.classList.add('tts-speaking');
    } else {
      card.classList.remove('tts-speaking');
    }
  }

  /** Flash the agent card briefly when interrupted by a human. */
  private flashInterrupted(agent: AgentId): void {
    const card = document.getElementById(`agent-${agent}`);
    if (!card) return;
    card.classList.add('tts-interrupted');
    setTimeout(() => card.classList.remove('tts-interrupted'), 1200);
  }
}
