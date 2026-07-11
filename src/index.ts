/**
 * Conclave Bootstrap
 * Assembles every track into one running system:
 *   Perception → Context → Agents (scheduler) → Kernel (arbitration) → Output,
 * and broadcasts normalized UIMessages to the browser over WebSocket.
 */
import { loadEnv } from './shared/load-env';
loadEnv();

import { loadConfig } from './config';
import { logger } from './shared/logger';
import { EventBus } from './events/event-bus';
import { EventType } from './events/event-types';

import { KnowledgeGraph } from './knowledge/knowledge-graph';
import { ContextEngine } from './context/context-engine';
import { similarityScore } from './context/matcher';

import { AgentRegistry } from './agents/agent-registry';
import { CTOAgent } from './agents/cto-agent';
import { ProductAgent } from './agents/product-agent';
import { FinanceAgent } from './agents/finance-agent';
import { ResearchAgent } from './agents/research-agent';
import { GeminiLlmClient } from './agents/gemini-llm-client';
import { MockLlmClient } from './agents/mock-llm-client';
import { ILlmClient } from './agents/interfaces';

import { CognitiveScheduler } from './kernel/cognitive-scheduler';
import { Arbitrator } from './kernel/arbitrator';
import { CognitiveBlackboard } from './kernel/blackboard';
import { AttentionGate } from './kernel/attention-gate';
import { AttentionBudget } from './kernel/attention-budget';
import { InterventionHistory } from './kernel/intervention-history';
import { AgentCooldownTracker } from './kernel/cooldown-tracker';
import { ITimeProvider, ISemanticComparator } from './kernel/interfaces';

import { SpeechSynthesizer } from './output/speech-synthesizer';

import { PerceptionEngine } from './perception/perception-engine';
import { MockGeminiConnector } from './perception/mock-gemini-connector';
import { MockCompressor } from './perception/mock-compressor';
import { SemanticCompressor } from './perception/semantic-compressor';
import { TranscriptProcessor } from './perception/transcript-processor';
import { DiarizationTracker } from './perception/diarization-tracker';
import { PauseDetector } from './perception/pause-detector';

import { UiWebSocketServer } from './ui/websocket-server';
import { Orchestrator } from './integration/orchestrator';
import type { AnyTypedEvent } from './events/event-schema';

const DEMO_SCRIPT = [
  { speakerTag: 'Priya', text: 'I think we should migrate our platform to Kubernetes this quarter.', delayMs: 900 },
  { speakerTag: 'Arjun', text: 'Agreed. Traffic will probably stay under ten thousand users anyway.', delayMs: 1300 },
  { speakerTag: 'Priya', text: 'Kubernetes gives us better scaling and safer rolling deploys.', delayMs: 1300 },
  { speakerTag: 'Arjun', text: 'But operating Kubernetes adds real complexity and on-call burden.', delayMs: 1300 },
  { speakerTag: 'Priya', text: 'What is the budget impact if the migration runs longer than planned?', delayMs: 1300 },
];

async function bootstrap() {
  const config = loadConfig();
  const hasGemini = config.gemini.apiKey.trim() !== '';
  logger.info('Bootstrapping Conclave...', {
    meetingId: config.meeting.meetingId,
    llm: hasGemini ? 'gemini' : 'mock',
  });

  const eventBus = new EventBus();
  const timeProvider: ITimeProvider = { now: () => Date.now() };

  // ── Context (Dev B) ──
  const knowledgeGraph = new KnowledgeGraph();
  const contextEngine = new ContextEngine(eventBus, knowledgeGraph);

  // ── Agents (Dev C) ──
  const llmClient: ILlmClient = hasGemini ? new GeminiLlmClient() : new MockLlmClient();
  const registry = new AgentRegistry();
  registry.register(new CTOAgent(llmClient));
  registry.register(new ProductAgent(llmClient));
  registry.register(new FinanceAgent(llmClient));
  registry.register(new ResearchAgent(llmClient));
  const scheduler = new CognitiveScheduler(registry);

  // ── Kernel primitives (Dev A) ──
  const blackboard = new CognitiveBlackboard();
  const attentionBudget = new AttentionBudget(config.meeting.attentionBudget, timeProvider);
  const attentionGate = new AttentionGate({ speakingTimeoutMs: 8000 }, timeProvider);
  const comparator: ISemanticComparator = { similarity: (a, b) => similarityScore(a, b) };
  const arbitrator = new Arbitrator(
    comparator,
    new InterventionHistory(20),
    new AgentCooldownTracker(config.meeting.attentionBudget.cooldownMs),
    timeProvider,
  );

  // ── Output (Dev C) ──
  const speech = new SpeechSynthesizer();

  // ── UI transport ──
  const wsServer = new UiWebSocketServer(config.server.wsPort);

  // ── Integration glue ──
  const orchestrator = new Orchestrator({
    contextEngine,
    scheduler,
    registry,
    arbitrator,
    attentionGate,
    attentionBudget,
    blackboard,
    timeProvider,
    broadcast: (message) => wsServer.broadcast(message),
    speech,
    interruptionCost: config.meeting.attentionBudget.interruptionBaseCost,
  });

  eventBus.subscribe(EventType.DELTA_PRODUCED, (event: AnyTypedEvent) => {
    if (event.type === EventType.DELTA_PRODUCED) {
      void orchestrator.enqueue(event.payload.delta);
    }
  });

  // ── Perception (Dev D) ──
  const compressor = hasGemini ? new SemanticCompressor() : new MockCompressor();
  const perceptionEngine = new PerceptionEngine({
    eventBus,
    connector: new MockGeminiConnector({ script: DEMO_SCRIPT }),
    transcriptProcessor: new TranscriptProcessor(),
    diarization: new DiarizationTracker(),
    pauseDetector: new PauseDetector(),
    compressor,
  });

  wsServer.broadcast({ kind: 'reset' });
  await perceptionEngine.start({
    meetingId: config.meeting.meetingId,
    sampleRate: config.perception.session.sampleRate,
    compressionBatchSize: config.perception.compressionBatchSize,
    compressionIntervalMs: config.perception.compressionIntervalMs,
    useMock: true,
  });

  logger.info('Conclave running', {
    ws: `ws://localhost:${config.server.wsPort}`,
    ui: `run "npm run dev:ui" and open the printed URL`,
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    await perceptionEngine.stop();
    wsServer.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

bootstrap().catch((error) => logger.error('Bootstrap failed', { error: String(error) }));
