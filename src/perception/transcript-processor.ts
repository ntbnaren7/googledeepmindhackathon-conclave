import type { ITranscriptProcessor } from './interfaces';
import type { RawTranscript, TranscriptSegment, Speaker } from './types';
import { generateId } from '@shared/id-generator';

/**
 * Converts raw transcript fragments from the connector into normalized,
 * speaker-attributed TranscriptSegment objects. Pure and synchronous.
 */
export class TranscriptProcessor implements ITranscriptProcessor {
  process(raw: RawTranscript, speaker: Speaker): TranscriptSegment {
    return {
      id: generateId(),
      speaker,
      text: raw.text.trim(),
      startMs: raw.startMs,
      endMs: raw.endMs,
      // Default to full confidence when the provider omits it.
      confidence: raw.confidence ?? 1,
    };
  }
}
