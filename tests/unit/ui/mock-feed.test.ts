import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockFeed } from '../../../src/ui/mock-feed';
import type { UIMessage } from '../../../src/ui/types';

function collectRun(): UIMessage[] {
  const feed = new MockFeed({ loop: false });
  const out: UIMessage[] = [];
  feed.start((m) => out.push(m));
  vi.advanceTimersByTime(9000);
  return out;
}

describe('MockFeed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits a reset first so a looped replay never duplicates', () => {
    const msgs = collectRun();
    expect(msgs[0]).toEqual({ kind: 'reset' });
  });

  it('puts ONLY human speakers in the transcript (no agent speech)', () => {
    const transcripts = collectRun().filter((m) => m.kind === 'transcript');
    expect(transcripts.length).toBeGreaterThanOrEqual(2);
    const speakers = new Set(
      transcripts.map((m) => (m.kind === 'transcript' ? m.line.speaker : '')),
    );
    expect(speakers).toEqual(new Set(['Priya', 'Arjun']));
    expect(speakers.has('CTO Agent')).toBe(false);
    expect(speakers.has('Finance Agent')).toBe(false);
  });

  it('surfaces agent recommendations as intervention notes', () => {
    const interventions = collectRun().filter((m) => m.kind === 'intervention');
    const notes = interventions
      .map((m) => (m.kind === 'intervention' ? m.intervention.note ?? '' : ''))
      .join(' ');
    expect(notes).toContain('100k within 6 months'); // CTO recommendation
    expect(notes).toContain('negative ROI'); // Finance recommendation
  });

  it('drives every panel kind', () => {
    const kinds = new Set(collectRun().map((m) => m.kind));
    for (const k of ['budget', 'context', 'transcript', 'blackboard', 'stakeholder', 'decision', 'intervention']) {
      expect(kinds.has(k as UIMessage['kind'])).toBe(true);
    }
  });
});
