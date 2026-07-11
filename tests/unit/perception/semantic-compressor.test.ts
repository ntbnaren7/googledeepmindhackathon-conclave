import { describe, expect, it, vi } from 'vitest';
import {
  SemanticCompressionClient,
  SemanticCompressor,
} from '../../../src/perception/semantic-compressor';
import { TranscriptSegment } from '../../../src/perception/types';

function buildSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 'segment-1',
    speaker: {
      id: 'speaker-1',
      label: 'Speaker 1',
      isHuman: true,
    },
    text: 'We should use managed Postgres.',
    startMs: 1000,
    endMs: 2000,
    confidence: 0.95,
    ...overrides,
  };
}

describe('SemanticCompressor', () => {
  it('compresses transcript segments into the aggregate SemanticDelta contract', async () => {
    const client: SemanticCompressionClient = {
      generate: vi.fn(async () =>
        JSON.stringify({
          units: [
            {
              id: 'segment-1',
              speakerId: 'speaker-1',
              content: 'We should use managed Postgres.',
              timestamp: 1000,
            },
          ],
          topics: [{ id: 'topic-1', label: 'Database architecture', confidence: 1.2 }],
          decisions: [
            {
              id: 'decision-1',
              description: 'Use managed Postgres',
              status: 'approved',
              timestamp: 1000,
            },
          ],
          assumptions: [
            {
              id: 'assumption-1',
              statement: 'Traffic stays below 10k users',
              challenged: false,
            },
          ],
          risks: [
            {
              id: 'risk-1',
              description: 'Cloud cost can rise',
              severity: -0.2,
            },
          ],
        }),
      ),
    };
    const compressor = new SemanticCompressor({ client });

    const delta = await compressor.compress([buildSegment()]);

    expect(client.generate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.generate).mock.calls[0][0]).toContain('segment-1');
    expect(delta).toEqual({
      units: [
        {
          id: 'segment-1',
          speakerId: 'speaker-1',
          content: 'We should use managed Postgres.',
          timestamp: 1000,
        },
      ],
      topics: [{ id: 'topic-1', label: 'Database architecture', confidence: 1 }],
      decisions: [
        {
          id: 'decision-1',
          description: 'Use managed Postgres',
          status: 'approved',
          timestamp: 1000,
        },
      ],
      assumptions: [
        {
          id: 'assumption-1',
          statement: 'Traffic stays below 10k users',
          challenged: false,
        },
      ],
      risks: [
        {
          id: 'risk-1',
          description: 'Cloud cost can rise',
          severity: 0,
        },
      ],
    });
  });

  it('extracts fenced JSON and skips malformed items', async () => {
    const client: SemanticCompressionClient = {
      generate: vi.fn(async () =>
        [
          '```json',
          JSON.stringify({
            units: [
              {
                id: 'segment-1',
                speakerId: 'speaker-1',
                content: 'Valid unit',
                timestamp: 1000,
              },
              {
                id: 'segment-2',
                speakerId: 'speaker-1',
                content: 'Missing timestamp',
              },
            ],
            topics: 'not-array',
            decisions: [{ id: 'decision-1', description: 'Bad status', status: 'done' }],
            assumptions: [{ id: 'assumption-1', statement: 'Valid assumption' }],
            risks: [{ id: 'risk-1', description: 'Valid risk', severity: 0.5 }],
          }),
          '```',
        ].join('\n'),
      ),
    };
    const compressor = new SemanticCompressor({ client });

    const delta = await compressor.compress([buildSegment()]);

    expect(delta).toEqual({
      units: [
        {
          id: 'segment-1',
          speakerId: 'speaker-1',
          content: 'Valid unit',
          timestamp: 1000,
        },
      ],
      topics: [],
      decisions: [],
      assumptions: [
        {
          id: 'assumption-1',
          statement: 'Valid assumption',
          challenged: false,
        },
      ],
      risks: [{ id: 'risk-1', description: 'Valid risk', severity: 0.5 }],
    });
  });

  it('passes through a valid unit type and drops an invalid one', async () => {
    const client: SemanticCompressionClient = {
      generate: vi.fn(async () =>
        JSON.stringify({
          units: [
            {
              id: 'segment-1',
              speakerId: 'speaker-1',
              content: 'Kubernetes is too complex to operate',
              timestamp: 1000,
              type: 'objection',
            },
            {
              id: 'segment-2',
              speakerId: 'speaker-1',
              content: 'No strong opinion',
              timestamp: 1100,
              type: 'not-a-real-type',
            },
          ],
          topics: [],
          decisions: [],
          assumptions: [],
          risks: [],
        }),
      ),
    };
    const compressor = new SemanticCompressor({ client });

    const delta = await compressor.compress([buildSegment()]);

    expect(delta.units).toEqual([
      {
        id: 'segment-1',
        speakerId: 'speaker-1',
        content: 'Kubernetes is too complex to operate',
        timestamp: 1000,
        type: 'objection',
      },
      {
        id: 'segment-2',
        speakerId: 'speaker-1',
        content: 'No strong opinion',
        timestamp: 1100,
      },
    ]);
  });

  it('returns an empty delta for malformed JSON', async () => {
    const compressor = new SemanticCompressor({
      client: { generate: vi.fn(async () => 'not-json') },
    });

    await expect(compressor.compress([buildSegment()])).resolves.toEqual({
      units: [],
      topics: [],
      decisions: [],
      assumptions: [],
      risks: [],
    });
  });

  it('returns an empty delta when the model client fails', async () => {
    const compressor = new SemanticCompressor({
      client: {
        generate: vi.fn(async () => {
          throw new Error('model unavailable');
        }),
      },
    });

    await expect(compressor.compress([buildSegment()])).resolves.toEqual({
      units: [],
      topics: [],
      decisions: [],
      assumptions: [],
      risks: [],
    });
  });

  it('does not call the model for empty transcript input', async () => {
    const client: SemanticCompressionClient = { generate: vi.fn() };
    const compressor = new SemanticCompressor({ client });

    const delta = await compressor.compress([buildSegment({ text: '   ' })]);

    expect(client.generate).not.toHaveBeenCalled();
    expect(delta).toEqual({
      units: [],
      topics: [],
      decisions: [],
      assumptions: [],
      risks: [],
    });
  });
});
