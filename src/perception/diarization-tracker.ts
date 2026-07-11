import type { IDiarizationTracker } from './interfaces';
import type { Speaker } from './types';
import { generateId } from '@shared/id-generator';

/**
 * Resolves consistent Speaker identities from provider speaker tags.
 *
 * We rely on Gemini's basic diarization tags as-is (PRD NG7). Each distinct tag
 * maps to a stable Speaker with a human-friendly label ("Speaker 1", ...). When
 * a fragment arrives with no tag, we attribute it to the most recently seen
 * speaker to preserve continuity, creating a first speaker if none exists yet.
 */
export class DiarizationTracker implements IDiarizationTracker {
  private readonly byTag = new Map<string, Speaker>();
  private lastResolved: Speaker | null = null;

  resolve(speakerTag: string | undefined): Speaker {
    if (speakerTag === undefined || speakerTag === '') {
      // No tag: continue with the current speaker, or bootstrap one.
      if (this.lastResolved) return this.lastResolved;
      return this.createSpeaker('__default__');
    }

    const existing = this.byTag.get(speakerTag);
    if (existing) {
      this.lastResolved = existing;
      return existing;
    }
    return this.createSpeaker(speakerTag);
  }

  getSpeakers(): Speaker[] {
    return [...this.byTag.values()];
  }

  private createSpeaker(tag: string): Speaker {
    const speaker: Speaker = {
      id: generateId(),
      label: `Speaker ${this.byTag.size + 1}`,
      isHuman: true,
    };
    this.byTag.set(tag, speaker);
    this.lastResolved = speaker;
    return speaker;
  }
}
