/**
 * Conclave Bootstrap
 * Initializes all modules in dependency order and starts the Cognitive Kernel.
 */
import 'dotenv/config';
import { loadConfig } from './config';
import { EventBus } from './events/event-bus';
import { KnowledgeGraph } from './knowledge/knowledge-graph';
import { ContextEngine } from './context/context-engine';
import { logger } from './shared/logger';
import { CognitiveKernel } from './kernel/cognitive-kernel';
import { CognitiveScheduler } from './kernel/cognitive-scheduler';
import { Arbitrator } from './kernel/arbitrator';
import { AttentionGate } from './kernel/attention-gate';
import { AttentionBudget } from './kernel/attention-budget';
import { CognitiveBlackboard as Blackboard } from './kernel/blackboard';
import { AgentCooldownTracker as CooldownTracker } from './kernel/cooldown-tracker';
import { InterventionHistory } from './kernel/intervention-history';
import { ISemanticComparator, ITimeProvider } from './kernel/interfaces';
import { OutputCoordinator } from './output/output-coordinator';
import { GeminiLlmClient } from './agents/gemini-client';
import { CTOAgent } from './agents/cto-agent';
import { FinanceAgent } from './agents/finance-agent';
import { ProductAgent } from './agents/product-agent';
import { ResearchAgent } from './agents/research-agent';
import { loadCompanyContext } from './agents/company-context';
import { GeminiLiveConnector } from './perception/gemini-live-connector';
import { TranscriptProcessor } from './perception/transcript-processor';
import { DiarizationTracker } from './perception/diarization-tracker';
import { PauseDetector } from './perception/pause-detector';
import { SemanticCompressor } from './perception/semantic-compressor';
import { PerceptionEngine } from './perception/perception-engine';
import { AgentLivePool } from './perception/agent-live-pool';
import { ConclaveWebSocketServer } from './server/ws-server';
class MockSemanticComparator implements ISemanticComparator {
  similarity(a: string, b: string) { return 0; }
}

const timeProvider: ITimeProvider = {
  now: () => Date.now()
};

async function bootstrap() {
  logger.info('Bootstrapping Conclave...');
  const config = loadConfig();

  // 1. Shared Event Bus
  const eventBus = new EventBus();

  // 2. Context Engine
  const knowledgeGraph = new KnowledgeGraph();
  const contextEngine = new ContextEngine(eventBus, knowledgeGraph);
  contextEngine.initialize(config);

  // 2.5 Perception Pipeline
  const connector = new GeminiLiveConnector(config.perception.session);
  const transcriptProcessor = new TranscriptProcessor();
  const diarization = new DiarizationTracker();
  const pauseDetector = new PauseDetector();
  const compressor = new SemanticCompressor({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
  });

  // 2.6 Multi-agent Live Pool
  // Each agent gets its own Gemini Live session (TEXT mode) with their persona
  // as the system instruction. All four hear the same audio stream and independently
  // decide when to speak. The pool arbitrates by urgency and voices the winner
  // through the main connector (AUDIO mode).
  // Set ENABLE_AGENT_POOL=false in .env to fall back to single-session mode.
  const enableAgentPool = process.env.ENABLE_AGENT_POOL !== 'false';
  const agentPool = enableAgentPool
    ? new AgentLivePool({
        apiKey: config.gemini.apiKey,
        model: config.perception.session.model,
        sampleRate: config.perception.session.sampleRate,
        outputConnector: connector,
        eventBus,
        postSpeechQuietMs: config.meeting.postSpeechQuietMs,
      })
    : undefined;

  if (agentPool) {
    logger.info('[bootstrap] multi-agent Live pool enabled', { agents: ['cto', 'finance', 'product', 'research'] });
  } else {
    logger.info('[bootstrap] multi-agent Live pool disabled (ENABLE_AGENT_POOL=false); using single-session council');
  }

  const perceptionEngine = new PerceptionEngine({
    eventBus,
    connector,
    transcriptProcessor,
    diarization,
    pauseDetector,
    compressor,
    agentPool,
  });

  // 3. Agent Registry
  const geminiClient = new GeminiLlmClient(config.gemini.apiKey, config.gemini.model);
  const company = loadCompanyContext();
  const agents = [
    new CTOAgent(geminiClient, company),
    new FinanceAgent(geminiClient, company),
    new ProductAgent(geminiClient, company),
    new ResearchAgent(geminiClient, company),
  ];

  // 4. Kernel Dependencies
  const scheduler = new CognitiveScheduler(agents);
  const history = new InterventionHistory(10);
  const cooldownTracker = new CooldownTracker(5000);
  const semanticComparator = new MockSemanticComparator();
  
  const arbitrator = new Arbitrator(
    semanticComparator,
    history,
    cooldownTracker,
    timeProvider
  );
  
  const blackboard = new Blackboard();
  const attentionGate = new AttentionGate({ speakingTimeoutMs: 5000 }, timeProvider);
  const attentionBudget = new AttentionBudget(
    {
      initialBudget:        config.meeting.attentionBudget.initialBudget,
      replenishRate:        config.meeting.attentionBudget.replenishRate,
      interruptionBaseCost: config.meeting.attentionBudget.interruptionBaseCost,
      cooldownMs:           config.meeting.attentionBudget.cooldownMs,
      minThreshold:         config.meeting.attentionBudget.minThreshold,   // was 10 — should be 0.3
    },
    timeProvider
  );

  // 5. Output Pipeline
  const outputCoordinator = new OutputCoordinator(eventBus, contextEngine, agents, connector);

  // 6. Orchestration Layer
  const kernel = new CognitiveKernel({
    arbitrator,
    blackboard,
    attentionGate,
    attentionBudget,
    timeProvider,
    scheduler,
    eventBus,
    contextEngine,
    agentTimeoutMs:        config.meeting.agentTimeoutMs,
    evaluationDebounceMs:  config.meeting.evaluationDebounceMs,
    postSpeechQuietMs:     config.meeting.postSpeechQuietMs,
  });

  // Start the engine and kernel
  await perceptionEngine.start({
    meetingId: config.meeting.meetingId,
    sampleRate: config.perception.session.sampleRate,
    compressionBatchSize: config.perception.compressionBatchSize,
    compressionIntervalMs: config.perception.compressionIntervalMs,
  });
  await kernel.start();

  // 7. WebSocket Server (UI Integration)
  const wsServer = new ConclaveWebSocketServer({
    port: config.server.wsPort,
    eventBus,
    perceptionEngine,
    connector,
    agentPool,
  });
  wsServer.start();

  logger.info('System fully bootstrapped and Kernel is listening.', {
    meetingId: config.meeting.meetingId,
    wsPort: config.server.wsPort,
  });

  return { eventBus, contextEngine, knowledgeGraph, kernel, outputCoordinator, perceptionEngine, wsServer };
}

bootstrap().catch((error) => logger.error('Bootstrap failed', { error: String(error) }));
