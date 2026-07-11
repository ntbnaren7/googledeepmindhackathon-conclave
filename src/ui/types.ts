/**
 * UI-facing view model and message protocol (Dev D).
 *
 * The UI consumes this normalized protocol rather than the backend's typed
 * events directly, because most backend `EventPayloadMap` payloads are still
 * empty. The WebSocket client translates real server events into these messages
 * once Dev A enriches the payloads; until then the mock feed emits them. Kept
 * self-contained (no `@shared`/node imports) so the browser bundle stays clean.
 */

export type AgentId = 'cto' | 'product' | 'finance' | 'research';
export type AgentStatus = 'idle' | 'thinking' | 'speaking';

export type BlackboardEntryType =
  | 'observation'
  | 'warning'
  | 'hypothesis'
  | 'question'
  | 'confidence_update'
  | 'agreement'
  | 'disagreement';

export type InterventionState = 'pending' | 'granted' | 'rejected' | 'deferred';
export type ArgumentKind = 'support' | 'oppose';

export interface BudgetView {
  /** 0..100 */
  percent: number;
  interruptions: number;
  threshold: number;
  /** Remaining cooldown in ms; 0 when not in cooldown. */
  cooldownMs: number;
}

export interface TranscriptLineView {
  id: string;
  speaker: string;
  /** Stable index used to color-code speakers consistently. */
  speakerIndex: number;
  text: string;
}

export interface BlackboardEntryView {
  id: string;
  agent: AgentId | 'system';
  type: BlackboardEntryType;
  content: string;
  tickId: number;
  converging?: boolean;
}

export interface StakeholderView {
  id: AgentId;
  status: AgentStatus;
  /** ms since epoch of last intervention, or null. */
  lastInterventionAt: number | null;
}

export interface DecisionArgumentView {
  text: string;
  kind: ArgumentKind;
  agent?: AgentId;
}

export interface DecisionView {
  id: string;
  label: string;
  arguments: DecisionArgumentView[];
}

export interface InterventionView {
  id: string;
  agent: AgentId;
  urgency: number;
  state: InterventionState;
  note?: string;
}

export interface ContextView {
  topic: string;
  assumptions: string[];
  decisions: string[];
  risks: string[];
}

export type UIMessage =
  | { kind: 'transcript'; line: TranscriptLineView }
  | { kind: 'budget'; budget: BudgetView }
  | { kind: 'blackboard'; entry: BlackboardEntryView }
  | { kind: 'stakeholder'; stakeholder: StakeholderView }
  | { kind: 'decision'; decision: DecisionView }
  | { kind: 'intervention'; intervention: InterventionView }
  | { kind: 'context'; context: ContextView }
  /** Tells the browser to speak the agent's response text aloud via TTS. */
  | { kind: 'agent-speak'; agent: AgentId; text: string }
  /** Signals the start of a fresh session; components clear their state. */
  | { kind: 'reset' };

export type UIMessageKind = UIMessage['kind'];

/** Messages the browser sends TO the backend (utterances driving the meeting). */
export type ClientMessage = { kind: 'say'; speaker: string; text: string };

/** A panel component. `mount` builds its DOM; `handle` applies a message. */
export interface UIComponent {
  /** Message kinds this component reacts to. */
  readonly kinds: readonly UIMessageKind[];
  mount(root: HTMLElement): void;
  handle(msg: UIMessage): void;
  /** Reset to the empty initial state (called on a `reset` message). */
  clear?(): void;
}
