import { IEventBus } from '../events/interfaces';
import { EventType } from '../events/event-types';
import { IStakeholderAgent } from '../agents/interfaces';
import { IAgentResponse } from '../shared/types';
import { logger } from '../shared/logger';
import { IContextEngine } from '../context/interfaces';
import { adaptContextSnapshot } from '../kernel/context-adapter';
import type { IGeminiLiveConnector } from '../perception/interfaces';

export class OutputCoordinator {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly contextEngine: IContextEngine,
    private readonly agents: readonly IStakeholderAgent[],
    /** Live connector used to voice agent responses as audio. Optional — logs only if not provided. */
    private readonly connector?: IGeminiLiveConnector
  ) {
    this.eventBus.subscribe(EventType.INTERRUPT_GRANTED, (e) => this.handleInterrupt(e).catch(err => {
      logger.error('Error in OutputCoordinator handleInterrupt', { error: String(err) });
    }));
  }

  private async handleInterrupt(event: { payload: { proposal: import('../shared/types').IAgentProposal, tickId: string } }) {
    const { proposal, tickId } = event.payload;
    const agent = this.agents.find(a => a.id === proposal.agentId);
    
    if (!agent) {
      logger.error('Agent not found for granted interrupt', { agentId: proposal.agentId, tickId });
      return;
    }

    try {
      const snapshot = adaptContextSnapshot(this.contextEngine.getSnapshot());
      
      logger.debug('Generating response for granted interrupt', { agentId: agent.id, tickId });
      const response = await agent.generateResponse(snapshot, proposal);
      
      if (!this.validateResponse(response)) {
        logger.warn('Response validation failed, skipping speech', { tickId, agentId: agent.id });
        return;
      }

      this.synthesizeSpeech(agent.id, response);
    } catch (err) {
      logger.error('Error generating or synthesizing response', { agentId: agent.id, error: String(err) });
    }
  }

  private validateResponse(response: IAgentResponse): boolean {
    if (!response || !response.content) return false;
    if (response.content.trim().length === 0) return false;
    if (response.content.length > 2000) return false;
    return true;
  }

  private synthesizeSpeech(agentId: string, response: IAgentResponse) {
    // Build a voiced prompt: identify the speaker then speak the content.
    const agentLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    const prompt = `[Speaking as ${agentLabel}]: ${response.content}`;

    logger.info(`[SPEECH OUT] ${agentLabel}: "${response.content.slice(0, 100)}..."`);

    if (this.connector?.isConnected()) {
      // Inject into the Live session — the model will speak it back as audio.
      this.connector.sendText(prompt);
      this.eventBus.publish({
        type: EventType.AGENT_SPEAKING,
        payload: {},
        source: 'output',
      });
    } else {
      logger.warn('[output] connector not connected \u2014 response logged only', { agentId });
    }
  }
}
