import { describe, it, expect } from 'vitest';
import { TranscriptProcessor } from '../../../src/perception/transcript-processor';
import { DiarizationTracker } from '../../../src/perception/diarization-tracker';
import type { RawTranscript, Speaker } from '../../../src/perception/types';

const speaker: Speaker = { id: 's1', label: 'Speaker 1', isHuman: true };

describe('TranscriptProcessor', () => {
  const processor = new TranscriptProcessor();

  it('produces a well-formed TranscriptSegment', () => {
    const raw: RawTranscript = {
      text: 'We should migrate to Kubernetes.',
      isFinal: true,
      startMs: 1000,
      endMs: 3000,
      confidence: 0.9,
    };
    const seg = processor.process(raw, speaker);
    expect(seg.id).toBeTruthy();
    expect(seg.speaker).toBe(speaker);
    expect(seg.text).toBe('We should migrate to Kubernetes.');
    expect(seg.startMs).toBe(1000);
    expect(seg.endMs).toBe(3000);
    expect(seg.confidence).toBe(0.9);
  });

  it('trims text and defaults confidence to 1 when omitted', () => {
    const raw: RawTranscript = {
      text: '  hello world  ',
      isFinal: true,
      startMs: 0,
      endMs: 500,
    };
    const seg = processor.process(raw, speaker);
    expect(seg.text).toBe('hello world');
    expect(seg.confidence).toBe(1);
  });

  it('gives each segment a unique id', () => {
    const raw: RawTranscript = { text: 'a', isFinal: true, startMs: 0, endMs: 1 };
    const a = processor.process(raw, speaker);
    const b = processor.process(raw, speaker);
    expect(a.id).not.toBe(b.id);
  });
});

describe('DiarizationTracker', () => {
  it('returns a stable speaker for the same tag', () => {
    const tracker = new DiarizationTracker();
    const a = tracker.resolve('speaker-A');
    const b = tracker.resolve('speaker-A');
    expect(a).toBe(b);
  });

  it('assigns distinct, numbered speakers for distinct tags', () => {
    const tracker = new DiarizationTracker();
    const a = tracker.resolve('speaker-A');
    const b = tracker.resolve('speaker-B');
    expect(a.id).not.toBe(b.id);
    expect(a.label).toBe('Speaker 1');
    expect(b.label).toBe('Speaker 2');
    expect(tracker.getSpeakers()).toHaveLength(2);
  });

  it('attributes untagged fragments to the most recent speaker', () => {
    const tracker = new DiarizationTracker();
    const a = tracker.resolve('speaker-A');
    const untagged = tracker.resolve(undefined);
    expect(untagged).toBe(a);
  });
});
