import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveKernel } from '../../../src/kernel/cognitive-kernel';
import { IArbitrator, IBlackboard, IAttentionGate, IAttentionBudget, ITimeProvider } from '../../../src/kernel/interfaces';
import { IAgentProposal } from '../../../src/shared/types';

describe('CognitiveKernel', () => {
  let arbitrator: any;
  let blackboard: any;
  let attentionGate: any;
  let attentionBudget: any;
  let timeProvider: any;
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
      getState: vi.fn().mockReturnValue({ interruptionCount: 0 }),
      canInterrupt: vi.fn().mockReturnValue(false),
      consume: vi.fn(),
    };
    timeProvider = {
      now: vi.fn().mockReturnValue(1000),
    };

    kernel = new CognitiveKernel({
      arbitrator,
      blackboard,
      attentionGate,
      attentionBudget,
      timeProvider,
    });
  });

  it('should tick budget and rotate blackboard even when no proposals exist', async () => {
    await kernel.executeTick();

    expect(attentionBudget.tick).toHaveBeenCalled();
    expect(arbitrator.evaluate).not.toHaveBeenCalled();
    expect(blackboard.rotate).toHaveBeenCalled();
  });

  it('should evaluate proposals and grant token if budget allows', async () => {
    const proposal: IAgentProposal = { agentId: 'A1', content: 'hello', urgency: 0.9 };
    kernel.submitProposal(proposal);

    arbitrator.evaluate.mockReturnValue({ granted: proposal, rejected: [], deferred: [] });
    attentionBudget.canInterrupt.mockReturnValue(true);
    attentionGate.tryGrant.mockReturnValue({ tokenId: 'token123' });

    await kernel.executeTick();

    expect(arbitrator.evaluate).toHaveBeenCalled();
    expect(attentionBudget.canInterrupt).toHaveBeenCalled();
    expect(attentionGate.tryGrant).toHaveBeenCalledWith(proposal);
    expect(attentionBudget.consume).toHaveBeenCalledWith(10);
    expect(blackboard.post).toHaveBeenCalledWith([{
      agentId: 'A1',
      content: 'hello',
      timestamp: 1000
    }]);
    expect(blackboard.rotate).toHaveBeenCalled();
  });

  it('should evaluate proposals but skip grant if budget does not allow', async () => {
    const proposal: IAgentProposal = { agentId: 'A1', content: 'hello', urgency: 0.9 };
    kernel.submitProposal(proposal);

    arbitrator.evaluate.mockReturnValue({ granted: proposal, rejected: [], deferred: [] });
    attentionBudget.canInterrupt.mockReturnValue(false);

    await kernel.executeTick();

    expect(arbitrator.evaluate).toHaveBeenCalled();
    expect(attentionBudget.canInterrupt).toHaveBeenCalled();
    expect(attentionGate.tryGrant).not.toHaveBeenCalled();
    expect(attentionBudget.consume).not.toHaveBeenCalled();
    expect(blackboard.post).not.toHaveBeenCalled();
    expect(blackboard.rotate).toHaveBeenCalled();
  });
});