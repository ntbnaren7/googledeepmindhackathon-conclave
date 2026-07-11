import type { UIMessage } from './types';

/** A scheduled UI message: `at` ms after feed start. */
interface ScheduledMessage {
  at: number;
  msg: UIMessage;
}

/**
 * A scripted demo session that drives every panel without a backend. Mirrors the
 * PRD §23 Kubernetes demo: normal discussion, agents thinking, blackboard
 * accumulation, a CTO intervention that drops the budget, blackboard
 * convergence, and a populated decision graph. Used until the live pipeline is
 * wired, and as the R7 demo fallback.
 */
const SCRIPT: ScheduledMessage[] = [
  { at: 200, msg: { kind: 'budget', budget: { percent: 100, interruptions: 0, threshold: 0.4, cooldownMs: 0 } } },
  { at: 200, msg: { kind: 'context', context: { topic: 'Kubernetes migration', assumptions: [], decisions: [], risks: [] } } },

  { at: 600, msg: { kind: 'transcript', line: { id: 't1', speaker: 'Priya', speakerIndex: 0, text: 'I think we should migrate our platform to Kubernetes this quarter.' } } },
  { at: 900, msg: { kind: 'stakeholder', stakeholder: { id: 'cto', status: 'thinking', lastInterventionAt: null } } },
  { at: 900, msg: { kind: 'stakeholder', stakeholder: { id: 'finance', status: 'thinking', lastInterventionAt: null } } },
  { at: 1600, msg: { kind: 'stakeholder', stakeholder: { id: 'cto', status: 'idle', lastInterventionAt: null } } },
  { at: 1600, msg: { kind: 'stakeholder', stakeholder: { id: 'finance', status: 'idle', lastInterventionAt: null } } },
  { at: 1600, msg: { kind: 'blackboard', entry: { id: 'b1', agent: 'cto', type: 'observation', content: 'Migration likely requires 3-6 months of effort.', tickId: 1 } } },

  { at: 2200, msg: { kind: 'transcript', line: { id: 't2', speaker: 'Arjun', speakerIndex: 1, text: 'Agreed. Traffic will probably stay under ten thousand users anyway.' } } },
  { at: 2500, msg: { kind: 'context', context: { topic: 'Kubernetes migration', assumptions: ['Traffic stays under 10k users'], decisions: [], risks: [] } } },
  { at: 2600, msg: { kind: 'stakeholder', stakeholder: { id: 'cto', status: 'thinking', lastInterventionAt: null } } },
  { at: 2600, msg: { kind: 'blackboard', entry: { id: 'b2', agent: 'research', type: 'hypothesis', content: 'Serverless may be cheaper at this scale.', tickId: 2 } } },

  // First intervention: CTO speaks, budget drops.
  { at: 3400, msg: { kind: 'stakeholder', stakeholder: { id: 'cto', status: 'speaking', lastInterventionAt: 3400 } } },
  { at: 3400, msg: { kind: 'intervention', intervention: { id: 'i1', agent: 'cto', urgency: 0.78, state: 'granted', note: 'Current growth suggests traffic will exceed 100k within 6 months — that changes the architecture requirements.' } } },
  { at: 3400, msg: { kind: 'budget', budget: { percent: 82, interruptions: 1, threshold: 0.45, cooldownMs: 0 } } },
  { at: 3600, msg: { kind: 'decision', decision: { id: 'd1', label: 'Migrate to Kubernetes', arguments: [
    { text: 'Scales better for growth', kind: 'support' },
    { text: 'Traffic assumption is likely wrong', kind: 'oppose', agent: 'cto' },
  ] } } },
  { at: 4600, msg: { kind: 'stakeholder', stakeholder: { id: 'cto', status: 'idle', lastInterventionAt: 3400 } } },

  // Blackboard convergence -> Finance intervenes.
  { at: 5000, msg: { kind: 'blackboard', entry: { id: 'b3', agent: 'finance', type: 'confidence_update', content: 'ROI turns negative if migration exceeds 4 months.', tickId: 3, converging: true } } },
  { at: 5200, msg: { kind: 'stakeholder', stakeholder: { id: 'finance', status: 'speaking', lastInterventionAt: 5200 } } },
  { at: 5200, msg: { kind: 'intervention', intervention: { id: 'i2', agent: 'finance', urgency: 0.81, state: 'granted', note: 'Multiple signals suggest negative ROI under the current assumptions (convergence: 3 agents aligned).' } } },
  { at: 5200, msg: { kind: 'budget', budget: { percent: 61, interruptions: 2, threshold: 0.5, cooldownMs: 0 } } },
  { at: 5400, msg: { kind: 'decision', decision: { id: 'd1', label: 'Migrate to Kubernetes', arguments: [
    { text: 'Scales better for growth', kind: 'support' },
    { text: 'Traffic assumption is likely wrong', kind: 'oppose', agent: 'cto' },
    { text: 'ROI negative if migration > 4 months', kind: 'oppose', agent: 'finance' },
  ] } } },
  { at: 5400, msg: { kind: 'context', context: { topic: 'Kubernetes migration', assumptions: ['Traffic stays under 10k users'], decisions: ['Migrate to Kubernetes (contested)'], risks: ['Negative ROI if migration > 4 months'] } } },
  { at: 6200, msg: { kind: 'stakeholder', stakeholder: { id: 'finance', status: 'idle', lastInterventionAt: 5200 } } },

  // Budget low: a proposal gets deferred.
  { at: 6800, msg: { kind: 'intervention', intervention: { id: 'i3', agent: 'research', urgency: 0.55, state: 'deferred', note: 'Budget low — only critical insights interrupt.' } } },
  { at: 6800, msg: { kind: 'budget', budget: { percent: 61, interruptions: 2, threshold: 0.5, cooldownMs: 0 } } },
];

export type FeedListener = (msg: UIMessage) => void;

/** Plays the scripted session, invoking `listener` for each message on schedule. */
export class MockFeed {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly loop: boolean;

  constructor(options: { loop?: boolean } = {}) {
    this.loop = options.loop ?? true;
  }

  start(listener: FeedListener): void {
    this.stop();
    // Begin every cycle from a clean slate so a looped replay never duplicates.
    listener({ kind: 'reset' });
    const total = SCRIPT.length ? SCRIPT[SCRIPT.length - 1].at + 1500 : 0;
    for (const { at, msg } of SCRIPT) {
      this.timers.push(setTimeout(() => listener(msg), at));
    }
    if (this.loop) {
      this.timers.push(setTimeout(() => this.start(listener), total));
    }
  }

  stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
