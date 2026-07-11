import type { IPauseDetector } from './interfaces';
import { PauseType, type PauseEvent } from './types';
import { RUNTIME_CONSTANTS } from '@shared/constants';

/** Upper bound (ms) for a NATURAL pause; anything longer is EXTENDED. */
const NATURAL_MAX_MS = 2000;

/**
 * Detects and classifies conversational pauses (PRD FR-103).
 *
 *   < 500ms          -> BRIEF    (speaker still in flow)
 *   500ms – 2000ms   -> NATURAL  (a normal conversational gap)
 *   > 2000ms         -> EXTENDED (a meaningful silence)
 *
 * `classify()` is pure. `observe()` is stateful: it tracks the timestamp of the
 * last activity and returns a PauseEvent when the gap since then reaches the
 * BRIEF boundary (i.e. a real pause), or null while the speaker is in flow.
 */
export class PauseDetector implements IPauseDetector {
  private readonly briefMaxMs = RUNTIME_CONSTANTS.SPEAKER_IN_FLOW_PAUSE_MS;
  private lastActivityMs: number | null = null;

  observe(atMs: number): PauseEvent | null {
    const previous = this.lastActivityMs;
    this.lastActivityMs = atMs;

    if (previous === null) return null;

    const gapMs = atMs - previous;
    if (gapMs < this.briefMaxMs) return null; // still in flow

    return { ...this.classify(gapMs), startedAt: previous };
  }

  classify(durationMs: number): PauseEvent {
    let type: PauseType;
    if (durationMs < this.briefMaxMs) {
      type = PauseType.BRIEF;
    } else if (durationMs <= NATURAL_MAX_MS) {
      type = PauseType.NATURAL;
    } else {
      type = PauseType.EXTENDED;
    }
    return { type, durationMs, startedAt: 0 };
  }
}
