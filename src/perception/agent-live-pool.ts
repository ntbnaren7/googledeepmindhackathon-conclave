/**
 * agent-live-pool.ts
 *
 * Manages four independent Gemini Live sessions (one per agent) and one
 * shared audio-output session.
 *
 * Architecture:
 *   - Four AgentLiveSession instances (TEXT mode) share the same audio stream.
 *   - Each session independently decides when to speak by firing onWantsToSpeak.
 *   - The pool arbitrates: the highest-urgency proposal within a collection
 *     window wins the floor.
 *   - The winner's text is sent to the main audio-output connector via sendText(),
 *     which voices it as model audio.
 *   - All other sessions are muted for a configurable quiet window after any
 *     agent speaks.
 *
 * Arbitration window:
 *   When the first agent fires, we open a short window (ARBITRATION_WINDOW_MS)
 *   to collect any competing proposals. The highest urgency wins. This prevents
 *   the fastest model from always winning regardless of relevance.
 */

import type { AudioChunk } from './types';
import type { IGeminiLiveConnector } from './interfaces';
import type { IEventBus } from '@events/interfaces';
import { EventType } from '@events/event-types';
import { AgentLiveSession } from './agent-live-session';
import {
  CTO_SYSTEM_INSTRUCTION,
  FINANCE_SYSTEM_INSTRUCTION,
  PRODUCT_SYSTEM_INSTRUCTION,
  RESEARCH_SYSTEM_INSTRUCTION,
} from './agent-session-personas';
import { logger } from '@shared/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How long (ms) to collect competing proposals before picking the winner.
 * Prevents the fastest session from always winning regardless of urgency.
 */
/**
 * How long (ms) to collect competing proposals before picking the winner.
 * Shorter = feels more spontaneous and human.
 */
const ARBITRATION_WINDOW_MS = 400;

/**
 * Minimum urgency score to grant the floor while user is quiet.
 * Lowered so agents interrupt more naturally.
 */
const MIN_URGENCY_TO_SPEAK = 0.3;

/**
 * Minimum urgency required to interrupt the user mid-sentence.
 * Must be HIGH or CRITICAL — we only cut someone off for serious reasons.
 */
const MIN_URGENCY_TO_INTERRUPT_USER = 0.50;

/**
 * How long (ms) all agents stay muted after one speaks.
 * Reduced to 5 seconds — long enough to avoid pile-ons, short enough to
 * feel conversational rather than dead air.
 */
const POST_SPEECH_QUIET_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentProposal {
  agentId: string;
  text: string;
  urgency: number;
  receivedAt: number;
}

export interface AgentLivePoolOptions {
  apiKey: string;
  model: string;
  sampleRate: number;
  /** The shared audio-output connector — winner's text is voiced through this. */
  outputConnector: IGeminiLiveConnector;
  eventBus: IEventBus;
  /** Override quiet window in ms. Default: 12000. */
  postSpeechQuietMs?: number;
}

// ---------------------------------------------------------------------------
// AgentLivePool
// ---------------------------------------------------------------------------

export class AgentLivePool {
  private readonly sessions: AgentLiveSession[];
  private readonly outputConnector: IGeminiLiveConnector;
  private readonly eventBus: IEventBus;
  private readonly postSpeechQuietMs: number;

  /** Pending proposals within the current arbitration window. */
  private pendingProposals: AgentProposal[] = [];
  private arbitrationTimer: ReturnType<typeof setTimeout> | null = null;

  /** Timestamp until which all agents are silenced post-speech. */
  private quietUntil = 0;

  /** Whether the user is currently speaking (VAD active). */
  private userIsSpeaking = false;

  constructor(opts: AgentLivePoolOptions) {
    this.outputConnector = opts.outputConnector;
    this.eventBus = opts.eventBus;
    this.postSpeechQuietMs = opts.postSpeechQuietMs ?? POST_SPEECH_QUIET_MS;

    // Build four independent sessions — one per agent, each with their own persona.
    const sessionConfig = {
      apiKey: opts.apiKey,
      model: opts.model,
      sampleRate: opts.sampleRate,
    };

    this.sessions = [
      new AgentLiveSession({ ...sessionConfig, agentId: 'cto',      systemInstruction: CTO_SYSTEM_INSTRUCTION }),
      new AgentLiveSession({ ...sessionConfig, agentId: 'finance',  systemInstruction: FINANCE_SYSTEM_INSTRUCTION }),
      new AgentLiveSession({ ...sessionConfig, agentId: 'product',  systemInstruction: PRODUCT_SYSTEM_INSTRUCTION }),
      new AgentLiveSession({ ...sessionConfig, agentId: 'research', systemInstruction: RESEARCH_SYSTEM_INSTRUCTION }),
    ];

    // Wire up each session's wants-to-speak callback
    for (const session of this.sessions) {
      session.onWantsToSpeak((agentId, text, urgency) => {
        this.onAgentWantsToSpeak(agentId, text, urgency);
      });
    }
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Fan audio to all four agent sessions simultaneously.
   * Each session handles its own lazy connect internally —
   * the first audio chunk it receives triggers the connection.
   *
   * NOTE: We always forward audio even during the post-speech quiet window.
   * Agents must hear the conversation in order to decide whether to interrupt.
   * The quiet window only gates *speaking*, not *listening*.
   */
  pushAudio(chunk: AudioChunk): void {
    // Always fan audio — agents need to hear to decide when to speak
    this.fanAudio(chunk);
  }

  /**
   * Called by the perception engine when VAD detects user speech start.
   * Lets the pool know the user is currently talking so we can correctly
   * apply the higher interruption-urgency threshold.
   */
  notifyUserSpeaking(speaking: boolean): void {
    this.userIsSpeaking = speaking;
    if (!speaking) {
      logger.debug('[agent-pool] user stopped speaking — normal urgency threshold restored');
    }
  }

  async connect(): Promise<void> {
    // No-op: agent sessions self-connect lazily on first audio chunk.
    // This prevents idle-timeout drops when sessions open before audio starts.
    logger.info('[agent-pool] ready (sessions will connect lazily on first audio)');
  }

  async disconnect(): Promise<void> {
    await Promise.all(this.sessions.map(s => s.disconnect()));
    logger.info('[agent-pool] all agent sessions disconnected');
  }

  // =========================================================================
  // Private
  // =========================================================================

  /** Deliver the same audio chunk to all agent sessions. */
  private fanAudio(chunk: AudioChunk): void {
    for (const session of this.sessions) {
      session.streamAudio(chunk);
    }
  }

  /**
   * Called when any agent session wants to speak.
   *
   * Opens an arbitration window so competing proposals can accumulate.
   * After the window closes, the highest-urgency proposal wins the floor.
   */
  private onAgentWantsToSpeak(agentId: string, text: string, urgency: number): void {
    const now = Date.now();

    // Reject if within post-speech quiet window
    if (now < this.quietUntil) {
      logger.debug(`[agent-pool] ${agentId} suppressed (quiet window active)`, {
        remainingMs: this.quietUntil - now,
      });
      return;
    }

    // If the user is currently speaking, require a higher urgency to interrupt them.
    // This models human behaviour: you only cut someone off when it really matters.
    const threshold = this.userIsSpeaking ? MIN_URGENCY_TO_INTERRUPT_USER : MIN_URGENCY_TO_SPEAK;
    if (urgency < threshold) {
      logger.debug(`[agent-pool] ${agentId} suppressed (urgency ${urgency} < threshold ${threshold})`, {
        userIsSpeaking: this.userIsSpeaking,
      });
      return;
    }

    if (this.userIsSpeaking) {
      logger.info(`[agent-pool] 🚨 ${agentId} interrupting user (urgency ${urgency})`);
    } else {
      logger.debug(`[agent-pool] proposal received`, { agentId, urgency, text: text.slice(0, 60) });
    }

    this.pendingProposals.push({ agentId, text, urgency, receivedAt: now });

    // Open the arbitration window if not already open
    if (!this.arbitrationTimer) {
      this.arbitrationTimer = setTimeout(() => {
        this.arbitrate();
      }, ARBITRATION_WINDOW_MS);
    }
  }

  /** Pick the winner from all proposals collected in the window. */
  private arbitrate(): void {
    this.arbitrationTimer = null;

    if (this.pendingProposals.length === 0) return;

    // Sort by urgency descending — highest urgency wins
    const sorted = [...this.pendingProposals].sort((a, b) => b.urgency - a.urgency);
    const winner = sorted[0];
    this.pendingProposals = [];

    logger.info('[agent-pool] 🎤 winner granted floor', {
      agentId: winner.agentId,
      urgency: winner.urgency,
      text: winner.text.slice(0, 100),
      competingAgents: sorted.slice(1).map(p => p.agentId),
    });

    // Voice the winner through the audio output session
    this.voiceWinner(winner);
  }

  private voiceWinner(winner: AgentProposal): void {
    if (!this.outputConnector.isConnected()) {
      logger.warn('[agent-pool] output connector not connected; cannot voice winner');
      return;
    }

    // Mute all agent sessions during quiet window
    const quietUntil = Date.now() + this.postSpeechQuietMs;
    this.quietUntil = quietUntil;
    for (const session of this.sessions) {
      session.mute();
    }

    // Inject the winner's text — the output connector voices it as audio
    this.outputConnector.sendText(winner.text);
    logger.info(`[council] 🔊 ${winner.agentId}: "${winner.text.slice(0, 120)}"`);

    // Emit AGENT_SPEAKING so the kernel's post-speech quiet window also activates
    this.eventBus.publish({
      type: EventType.AGENT_SPEAKING,
      payload: { audioBuffer: new ArrayBuffer(0) },
      source: 'agent-pool',
    });

    // Unmute after quiet window
    setTimeout(() => {
      this.quietUntil = 0;
      for (const session of this.sessions) {
        session.unmute();
      }
      logger.debug('[agent-pool] quiet window expired; agents unmuted');
    }, this.postSpeechQuietMs);
  }
}
