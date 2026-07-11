import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../src/events/event-bus';
import { EventType } from '../../../src/events/event-types';
import { PerceptionEngine } from '../../../src/perception/perception-engine';
import { MockGeminiConnector } from '../../../src/perception/mock-gemini-connector';
import { MockCompressor } from '../../../src/perception/mock-compressor';
import { TranscriptProcessor } from '../../../src/perception/transcript-processor';
import { DiarizationTracker } from '../../../src/perception/diarization-tracker';
import { PauseDetector } from '../../../src/perception/pause-detector';
import type { AnyTypedEvent } from '../../../src/events/event-schema';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildEngine(collected: AnyTypedEvent[]) {
  const eventBus = new EventBus();
  eventBus.subscribeAll((e) => collected.push(e));

  const connector = new MockGeminiConnector({
    script: [
      { speakerTag: 'A', text: 'We should migrate to Kubernetes.', delayMs: 5 },
      { speakerTag: 'B', text: 'It will probably stay under ten thousand users.', delayMs: 5 },
    ],
  });

  const engine = new PerceptionEngine({
    eventBus,
    connector,
    transcriptProcessor: new TranscriptProcessor(),
    diarization: new DiarizationTracker(),
    pauseDetector: new PauseDetector(),
    compressor: new MockCompressor(),
  });

  return { engine, eventBus };
}

describe('PerceptionEngine (mock pipeline)', () => {
  it('produces a DELTA_PRODUCED event with compressed units', async () => {
    const collected: AnyTypedEvent[] = [];
    const { engine } = buildEngine(collected);

    await engine.start({
      meetingId: 'test',
      sampleRate: 16000,
      compressionBatchSize: 2, // flush after both scripted lines
      compressionIntervalMs: 10_000, // large: rely on batch-size trigger
      useMock: true,
    });

    await wait(80); // let the 2 scripted lines replay and flush
    await engine.stop();

    const deltas = collected.filter((e) => e.type === EventType.DELTA_PRODUCED);
    expect(deltas.length).toBeGreaterThanOrEqual(1);

    const payload = deltas[0].payload as { delta: { units: unknown[] } };
    expect(payload.delta.units.length).toBe(2);
  });

  it('emits TRANSCRIPT_UPDATE and SPEAKER_STARTED signals', async () => {
    const collected: AnyTypedEvent[] = [];
    const { engine } = buildEngine(collected);

    await engine.start({
      meetingId: 'test',
      sampleRate: 16000,
      compressionBatchSize: 2,
      compressionIntervalMs: 10_000,
      useMock: true,
    });
    await wait(80);
    await engine.stop();

    const transcripts = collected.filter((e) => e.type === EventType.TRANSCRIPT_UPDATE);
    const speakerStarts = collected.filter((e) => e.type === EventType.SPEAKER_STARTED);
    expect(transcripts.length).toBe(2);
    // Two distinct speakers (A, B) => two SPEAKER_STARTED transitions.
    expect(speakerStarts.length).toBe(2);
  });

  it('every published event carries id, timestamp, and source', async () => {
    const collected: AnyTypedEvent[] = [];
    const { engine } = buildEngine(collected);
    await engine.start({
      meetingId: 'test',
      sampleRate: 16000,
      compressionBatchSize: 2,
      compressionIntervalMs: 10_000,
    });
    await wait(80);
    await engine.stop();

    expect(collected.length).toBeGreaterThan(0);
    for (const e of collected) {
      expect(e.id).toBeTruthy();
      expect(typeof e.timestamp).toBe('number');
      expect(e.source).toBe('perception');
    }
  });
});
