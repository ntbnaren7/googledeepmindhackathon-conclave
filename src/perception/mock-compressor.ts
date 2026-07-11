import type { ISemanticCompressor } from './interfaces';
import type { TranscriptSegment } from './types';
import type {
  SemanticDelta,
  ISemanticUnit,
  IDecision,
  IAssumption,
  IRisk,
} from '@shared/types';
import { generateId } from '@shared/id-generator';

/**
 * A naive, dependency-free semantic compressor used until Dev B's real
 * Gemini-backed `semantic-compressor.ts` is available. It maps each transcript
 * segment to a semantic unit and applies simple keyword heuristics to surface a
 * few decisions / assumptions / risks, so the perception pipeline can emit
 * meaningful `DELTA_PRODUCED` events for local development and the demo
 * fallback. Dev D swaps this for Dev B's implementation at Checkpoint 4.
 */
export class MockCompressor implements ISemanticCompressor {
  async compress(segments: TranscriptSegment[]): Promise<SemanticDelta> {
    const units: ISemanticUnit[] = [];
    const decisions: IDecision[] = [];
    const assumptions: IAssumption[] = [];
    const risks: IRisk[] = [];

    for (const segment of segments) {
      const text = segment.text.trim();
      if (text === '') continue;

      units.push({
        id: segment.id,
        speakerId: segment.speaker.id,
        content: text,
        timestamp: segment.startMs,
      });

      const t = text.toLowerCase();
      if (/\b(should|let us|let's|propose|migrate to|adopt|commit to)\b/.test(t)) {
        decisions.push({
          id: generateId(),
          description: text,
          status: 'proposed',
          timestamp: segment.startMs,
        });
      }
      if (/\b(probably|assume|only take|anyway|no problem|should not|will stay)\b/.test(t)) {
        assumptions.push({ id: generateId(), statement: text, challenged: false });
      }
      if (/\b(cost|budget|price|roi|expensive|infrastructure)\b/.test(t)) {
        risks.push({ id: generateId(), description: text, severity: 0.5 });
      }
    }

    return { units, topics: [], decisions, assumptions, risks };
  }
}
