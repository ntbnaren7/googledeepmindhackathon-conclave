import type {
  IPerceptionEngine,
  IGeminiLiveConnector,
  ITranscriptProcessor,
  IDiarizationTracker,
  IPauseDetector,
  ISemanticCompressor,
  PerceptionSessionConfig,
} from './interfaces';
import type { RawTranscript, TranscriptSegment, Speaker } from './types';
import type { IEventBus } from '@events/interfaces';
import type { SemanticDelta } from '@shared/types';
import { EventType } from '@events/event-types';
import { logger } from '@shared/logger';

export interface PerceptionEngineDeps {
  eventBus: IEventBus;
  connector: IGeminiLiveConnector;
  transcriptProcessor: ITranscriptProcessor;
  diarization: IDiarizationTracker;
  pauseDetector: IPauseDetector;
  compressor: ISemanticCompressor;
}

/** Source tag stamped on every event this module publishes. */
const SOURCE = 'perception';

/** True when a delta carries nothing on any channel. */
function isEmptySemanticDelta(delta: SemanticDelta): boolean {
  return (
    delta.units.length === 0 &&
    delta.topics.length === 0 &&
    delta.decisions.length === 0 &&
    delta.assumptions.length === 0 &&
    delta.risks.length === 0
  );
}

/**
 * Orchestrates the perception pipeline:
 *   connector -> diarization -> transcript processor -> pause detector
 *   -> batch -> semantic compressor -> DELTA_PRODUCED
 *
 * Final transcript fragments become normalized segments. Segments are buffered
 * and flushed to the compressor either when the batch fills or on a fixed
 * interval, producing a SemanticDelta that is published for the kernel.
 *
 * NOTE (Dev A payload dependency): TRANSCRIPT_UPDATE / SPEAKER_* / PAUSE_DETECTED
 * currently carry empty payloads in Dev A's EventPayloadMap, so they are emitted
 * as signals only. Once he enriches the map, attach `{ segment }`/`{ speaker }`/
 * `{ pause }` at the marked call sites.
 */
export class PerceptionEngine implements IPerceptionEngine {
  private readonly deps: PerceptionEngineDeps;
  private config: PerceptionSessionConfig | null = null;
  private batch: TranscriptSegment[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentSpeaker: Speaker | null = null;
  private running = false;

  constructor(deps: PerceptionEngineDeps) {
    this.deps = deps;
  }

  async start(config: PerceptionSessionConfig): Promise<void> {
    if (this.running) return;
    this.config = config;
    this.running = true;

    this.deps.connector.onTranscript((raw) => this.handleTranscript(raw));
    await this.deps.connector.connect();

    // Periodic flush so a partial batch still gets compressed.
    this.flushTimer = setInterval(
      () => void this.flush(),
      config.compressionIntervalMs,
    );
    logger.info('[perception] started', { meetingId: config.meetingId });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush(); // drain remaining segments
    await this.deps.connector.disconnect();
    logger.info('[perception] stopped');
  }

  private handleTranscript(raw: RawTranscript): void {
    // Only final fragments become segments; interim ones are ignored for now.
    if (!raw.isFinal) return;

    const speaker = this.deps.diarization.resolve(raw.speakerTag);
    this.trackSpeakerChange(speaker, raw.startMs);

    // Detect the pause that preceded this speech.
    const pause = this.deps.pauseDetector.observe(raw.startMs);
    if (pause) {
      // TODO(Dev A payload): payload should be `{ pause }`.
      this.deps.eventBus.publish({
        type: EventType.PAUSE_DETECTED,
        payload: {},
        source: SOURCE,
      });
    }

    const segment = this.deps.transcriptProcessor.process(raw, speaker);
    if (segment.text === '') return;

    // TODO(Dev A payload): payload should be `{ segment }`.
    this.deps.eventBus.publish({
      type: EventType.TRANSCRIPT_UPDATE,
      payload: {},
      source: SOURCE,
    });

    this.batch.push(segment);
    const batchSize = this.config?.compressionBatchSize ?? 3;
    if (this.batch.length >= batchSize) void this.flush();
  }

  private trackSpeakerChange(speaker: Speaker, atMs: number): void {
    if (this.currentSpeaker?.id === speaker.id) return;
    if (this.currentSpeaker) {
      // TODO(Dev A payload): payload should be `{ speaker: this.currentSpeaker, at: atMs }`.
      this.deps.eventBus.publish({
        type: EventType.SPEAKER_STOPPED,
        payload: {},
        source: SOURCE,
      });
    }
    this.currentSpeaker = speaker;
    // TODO(Dev A payload): payload should be `{ speaker, at: atMs }`.
    this.deps.eventBus.publish({
      type: EventType.SPEAKER_STARTED,
      payload: {},
      source: SOURCE,
    });
  }

  /** Compress the buffered segments and publish a DELTA_PRODUCED event. */
  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;
    const segments = this.batch;
    this.batch = [];

    try {
      const delta = await this.deps.compressor.compress(segments);
      // Publish unless the delta is empty across ALL channels. Gating on units
      // alone would drop a delta that carries only decisions/topics/assumptions/
      // risks, starving the Context Engine of that structure.
      if (isEmptySemanticDelta(delta)) return;
      this.deps.eventBus.publish({
        type: EventType.DELTA_PRODUCED,
        payload: { delta },
        source: SOURCE,
      });
    } catch (error) {
      logger.error('[perception] compression failed', { error: String(error) });
    }
  }
}
