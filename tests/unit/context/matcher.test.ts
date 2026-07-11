import { describe, expect, it } from 'vitest';
import { similarityScore, bestMatchIndex } from '../../../src/context/matcher';

describe('similarityScore', () => {
  it('scores overlapping sentences higher than disjoint ones', () => {
    const high = similarityScore(
      'Use managed Postgres for our database',
      'We should use a managed Postgres database',
    );
    const low = similarityScore(
      'Use managed Postgres for our database',
      'The marketing budget looks fine next quarter',
    );
    expect(high).toBeGreaterThan(0.3);
    expect(low).toBeLessThan(0.1);
  });

  it('returns 0 when either side has no significant tokens', () => {
    expect(similarityScore('', 'anything at all here')).toBe(0);
    expect(similarityScore('the and for', 'the and for')).toBe(0);
  });
});

describe('bestMatchIndex', () => {
  it('returns the index of the best candidate above threshold', () => {
    const candidates = [
      { text: 'Adopt Kubernetes for the platform infrastructure' },
      { text: 'Increase the marketing budget next quarter' },
    ];
    const index = bestMatchIndex(
      'Kubernetes infrastructure is the right platform choice',
      candidates,
      (c) => c.text,
    );
    expect(index).toBe(0);
  });

  it('returns -1 when nothing clears the threshold', () => {
    const candidates = [{ text: 'Adopt Kubernetes for the platform' }];
    const index = bestMatchIndex('completely unrelated weather chatter', candidates, (c) => c.text);
    expect(index).toBe(-1);
  });

  it('returns -1 for an empty candidate list', () => {
    expect(bestMatchIndex('anything', [], (c: { text: string }) => c.text)).toBe(-1);
  });
});
