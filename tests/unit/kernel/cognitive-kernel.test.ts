import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveKernel } from '../../../src/kernel/cognitive-kernel';
import { IAgentProposal, ContextSnapshot, SemanticDelta } from '../../../src/shared/types';
import { EventType } from '../../../src/events/event-types';

describe('CognitiveKernel', () => {
  let arbitrator: any;
  let blackboard: any;
  let attentionGate: any;
  let attentionBudget: any;
  let timeProvider: any;
  let scheduler: any;
  let eventBus: any;
  let contextEngine: any;
  let kernel: CognitiveKernel;

  beforeEach(() => {
    arbitrator = {
      evaluate: vi.fn().mockReturnValue({ granted: null, rejected: [], deferred: [] }),
    };
    blackboard = {
      post: vi.fn(),
      rotate: vi.fn(),
      getState: vi.fn().mockReturnValue([]),
    };
    attentionGate = {
      isAgentSpeaking: vi.fn().mockReturnValue(false),
      tryGrant: vi.fn().mockReturnValue(null),
    };
    attentionBudget = {
      tick: vi.fn(),
      getState: vi.fn().mockReturnValue({ interruptionCount: 0, remaining: 100 }),
      canInterrupt: vi.fn().mockReturnValue(true),
      consume: vi.fn(),
    };
    timeProvider = {
      now: vi.fn().mockReturnValue(1000),
    };
    scheduler = {
      dispatch: vi.fn().mockResolvedValue([]),
    };
    eventBus = {
      subscribe: vi.fn(),
      publish: vi.fn(),
    };
    contextEngine = {
      getSnapshot: vi.fn(),
    };

    kernel = new CognitiveKernel({
      arbitrator,
      blackboard,
      attentionGate,
      attentionBudget,
      timeProvider,
      scheduler,
      eventBus,
      contextEngine
    });
    
    // Bypass actual event subscription for tests to just call wake()
    kernel['isRunning'] = true;
  });

  const emptySnapshot: ContextSnapshot = {
    id: 'snap1',
    timestamp: 1000,
    currentTopic: null,
    topicHistory: [],
    decisions: [],
    assumptions: [],
    risks: [],
    interventions: []
  };

  const emptyDelta: SemanticDelta = {
    units: [],
    topics: [],
    decisions: [],
    assumptions: [],
    risks: []
  };

  it('should tick budget and evaluate if budget allows', async () => {
    await kernel.wake(emptySnapshot, emptyDelta);

    expect(attentionBudget.tick).toHaveBeenCalled();
    expect(scheduler.dispatch).toHaveBeenCalled();
    expect(arbitrator.evaluate).not.toHaveBeenCalled(); // No proposals returned
    expect(blackboard.rotate).toHaveBeenCalled();
  });

  it('should evaluate proposals and grant token if budget allows', async () => {
    const proposal: IAgentProposal = { agentId: 'A1', content: 'hello', urgency: 0.9 };
    scheduler.dispatch.mockResolvedValue([{ proposal, blackboardEntries: [] }]);
    arbitrator.evaluate.mockReturnValue({ granted: proposal, rejected: [], deferred: [] });
    attentionGate.tryGrant.mockReturnValue({ tokenId: 'token123' });

    await kernel.wake(emptySnapshot, emptyDelta);

    expect(arbitrator.evaluate).toHaveBeenCalled();
    expect(attentionGate.tryGrant).toHaveBeenCalledWith(proposal);
    expect(attentionBudget.consume).toHaveBeenCalledWith(10);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: EventType.INTERRUPT_GRANTED
    }));
    expect(blackboard.rotate).toHaveBeenCalled();
  });

  it('should skip evaluation if budget does not allow', async () => {
    attentionBudget.canInterrupt.mockReturnValue(false);

    await kernel.wake(emptySnapshot, emptyDelta);

    expect(attentionBudget.tick).toHaveBeenCalled();
    expect(scheduler.dispatch).not.toHaveBeenCalled();
    expect(arbitrator.evaluate).not.toHaveBeenCalled();
  });
});
