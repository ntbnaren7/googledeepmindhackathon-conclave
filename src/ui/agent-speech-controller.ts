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
  }

  handle(msg: UIMessage): void {
    if (msg.kind === 'agent-speak') {
      this.startSpeaking(msg.agent, msg.text);
    } else if (msg.kind === 'transcript') {
      // A human is speaking/typing — interrupt the agent if it's talking.
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
  }

  private interruptSpeech(reason: 'human' | 'manual' | 'reset'): void {
    if (!this.speaking) return;

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
    const agent = this.currentAgent;
    this.speaking = false;
    this.currentAgent = null;
    this.hideOverlay();
    if (agent) this.setAgentCardSpeaking(agent, false);
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
