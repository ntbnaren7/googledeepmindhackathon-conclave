import type {
  IPerceptionEngine,
  IGeminiLiveConnector,
  ITranscriptProcessor,
  IDiarizationTracker,
  IPauseDetector,
  ISemanticCompressor,
  PerceptionSessionConfig,
} from './interfaces';
import type { RawTranscript, TranscriptSegment, Speaker, AudioChunk } from './types';
import type { IEventBus } from '@events/interfaces';
import type { SemanticDelta } from '@shared/types';
import { EventType } from '@events/event-types';
import { logger } from '@shared/logger';
import type { AgentLivePool } from './agent-live-pool';

export interface PerceptionEngineDeps {
  eventBus: IEventBus;
  connector: IGeminiLiveConnector;
  transcriptProcessor: ITranscriptProcessor;
  diarization: IDiarizationTracker;
  pauseDetector: IPauseDetector;
  compressor: ISemanticCompressor;
  /**
   * The multi-agent Live pool.
   * When provided, each audio chunk is fanned to all four agent sessions
   * in parallel with the main connector.
   */
  agentPool?: AgentLivePool;
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
  private liveConnected = false;
  private connecting = false;

  constructor(deps: PerceptionEngineDeps) {
    this.deps = deps;
  }

  async start(config: PerceptionSessionConfig): Promise<void> {
    if (this.running) return;
    this.config = config;
    this.running = true;

    this.deps.connector.onTranscript((raw) => this.handleTranscript(raw));
    this.deps.connector.onAudioResponse((buffer) => {
      // Forward model audio directly to the event bus so the WS server
      // can stream it to connected browser clients for playback.
      this.deps.eventBus.publish({
        type: EventType.AGENT_SPEAKING,
        payload: { audioBuffer: buffer },
        source: SOURCE,
      });
    });
    this.deps.connector.onDisconnect(() => {
      // Reset so the next audio chunk triggers a fresh lazy connect.
      this.liveConnected = false;
      this.connecting = false;
      logger.warn('[perception] live connector dropped; will reconnect on next audio chunk');
    });
    // NOTE: We intentionally do NOT connect here. The Gemini Live API drops
    // idle sessions, so we defer connection until the first audio chunk
    // arrives via pushAudio(). This prevents the reconnect loop at startup.

    // Periodic flush so a partial batch still gets compressed.
    this.flushTimer = setInterval(() => void this.flush(), config.compressionIntervalMs);
    logger.info('[perception] started (connector deferred until audio arrives)', { meetingId: config.meetingId });
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

  pushAudio(chunk: AudioChunk): void {
    if (!this.running) return;

    // Lazily connect on first audio chunk.
    if (!this.liveConnected && !this.connecting) {
      this.connecting = true;
      this.deps.connector.connect()
        .then(() => {
          this.liveConnected = true;
          this.connecting = false;
          logger.info('[perception] live connector opened on first audio');
          // Stream the chunk that triggered the connect.
          this.deps.connector.streamAudio(chunk);
          // Also fan to agent pool (it handles its own lazy connect internally).
          this.deps.agentPool?.pushAudio(chunk);
        })
        .catch((err) => {
          this.connecting = false;
          logger.error('[perception] deferred connect failed', { error: String(err) });
        });
      return;
    }

    if (this.liveConnected) {
      this.deps.connector.streamAudio(chunk);
      // Fan the same chunk to all four agent sessions simultaneously.
      this.deps.agentPool?.pushAudio(chunk);
    }
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
