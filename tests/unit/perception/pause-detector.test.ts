import { describe, it, expect } from 'vitest';
import { PauseDetector } from '../../../src/perception/pause-detector';
import { PauseType } from '../../../src/perception/types';

describe('PauseDetector.classify', () => {
  const detector = new PauseDetector();

  it('classifies brief pauses (< 500ms)', () => {
    expect(detector.classify(200).type).toBe(PauseType.BRIEF);
  });

  it('classifies natural pauses (500-2000ms)', () => {
    expect(detector.classify(500).type).toBe(PauseType.NATURAL);
    expect(detector.classify(1000).type).toBe(PauseType.NATURAL);
    expect(detector.classify(2000).type).toBe(PauseType.NATURAL);
  });

  it('classifies extended pauses (> 2000ms)', () => {
    expect(detector.classify(2001).type).toBe(PauseType.EXTENDED);
    expect(detector.classify(6000).type).toBe(PauseType.EXTENDED);
  });

  it('preserves the duration on the event', () => {
    expect(detector.classify(1234).durationMs).toBe(1234);
  });
});

describe('PauseDetector.observe', () => {
  it('returns null on the first observation (no prior activity)', () => {
    const detector = new PauseDetector();
    expect(detector.observe(1000)).toBeNull();
  });

  it('returns null while the speaker is in flow (gap < 500ms)', () => {
    const detector = new PauseDetector();
    detector.observe(1000);
    expect(detector.observe(1300)).toBeNull();
  });

  it('emits a classified pause when the gap crosses the brief boundary', () => {
    const detector = new PauseDetector();
    detector.observe(1000);
    const pause = detector.observe(4000); // 3000ms gap
    expect(pause).not.toBeNull();
    expect(pause?.type).toBe(PauseType.EXTENDED);
    expect(pause?.durationMs).toBe(3000);
    expect(pause?.startedAt).toBe(1000);
  });
});
