/**
 * Conclave Bootstrap
 * Initializes all modules in dependency order and starts the Cognitive Kernel.
 */
import { loadConfig } from './config';
import { EventBus } from './events/event-bus';
import { KnowledgeGraph } from './knowledge/knowledge-graph';
import { ContextEngine } from './context/context-engine';
import { logger } from './shared/logger';

async function bootstrap() {
  logger.info('Bootstrapping Conclave...');
  const config = loadConfig();

  // Shared event bus that every module communicates through.
  const eventBus = new EventBus();

  // Context track (Dev B): world model + append-only knowledge log. Calling
  // initialize() subscribes the engine to DELTA_PRODUCED so it updates its
  // snapshot as perception emits semantic deltas.
  const knowledgeGraph = new KnowledgeGraph();
  const contextEngine = new ContextEngine(eventBus, knowledgeGraph);
  contextEngine.initialize(config);

  // TODO (Dev A/C/D): wire Perception, Agents, the Cognitive Kernel, and the
  // UI/WebSocket server onto the same eventBus. The Kernel must pull
  // contextEngine.getSnapshot() at the start of each tick.
  logger.info('Context track initialized; awaiting remaining modules', {
    meetingId: config.meeting.meetingId,
  });

  return { eventBus, contextEngine, knowledgeGraph };
}

bootstrap().catch((error) => logger.error('Bootstrap failed', { error: String(error) }));
