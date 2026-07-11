import { describe, it, expect, beforeEach } from 'vitest';
import { AttentionGate } from '../../../src/kernel/attention-gate';
import { ITimeProvider } from '../../../src/kernel/interfaces';
import { InterventionProposal } from '../../../src/shared/types';

describe('AttentionGate', () => {
  let gate: AttentionGate;
  let timeProvider: ITimeProvider;
  let currentTime: number;

  const config = {
    speakingTimeoutMs: 30000,
  };

  const mockProposal: InterventionProposal = {
    id: 'prop-1',
    agentId: 'agent-1',
    triggerEventId: 'evt-1',
    createdAt: 1000,
    relevance: 0.9,
    severity: 0.8,
    confidence: 0.9,
    informationGain: 0.8,
    timeCriticality: 0.5,
    interruptCost: 10,
    urgency: 0.8,
    reason: 'Test reason',
    recommendation: 'Test rec',
  };

  beforeEach(() => {
    currentTime = 1000000;
    timeProvider = {
      now: () => currentTime,
    };
    gate = new AttentionGate(config, timeProvider);
  });

  it('tryGrant returns a valid SpeakingToken when free', () => {
    const token = gate.tryGrant(mockProposal);
    expect(token).not.toBeNull();
    expect(token!.agentId).toBe('agent-1');
    expect(token!.proposalId).toBe('prop-1');
    expect(token!.grantedAt).toBe(currentTime);
    expect(token!.expiresAt).toBe(currentTime + config.speakingTimeoutMs);
    expect(Object.isFrozen(token)).toBe(true);
  });

  it('tryGrant returns null when another agent is speaking (FR-706)', () => {
    gate.tryGrant(mockProposal);
    
    const anotherProposal = { ...mockProposal, id: 'prop-2', agentId: 'agent-2' };
    const secondToken = gate.tryGrant(anotherProposal);
    expect(secondToken).toBeNull();
  });

  it('tryGrant auto-revokes expired tokens and grants new one', () => {
    gate.tryGrant(mockProposal);
    
    currentTime += config.speakingTimeoutMs + 1000; // expire first token
    
    const anotherProposal = { ...mockProposal, id: 'prop-2', agentId: 'agent-2' };
    const secondToken = gate.tryGrant(anotherProposal);
    expect(secondToken).not.toBeNull();
    expect(secondToken!.agentId).toBe('agent-2');
  });

  it('isAgentSpeaking returns correct state based on time', () => {
    expect(gate.isAgentSpeaking()).toBe(false);
    
    gate.tryGrant(mockProposal);
    expect(gate.isAgentSpeaking()).toBe(true);
    
    currentTime += config.speakingTimeoutMs;
    expect(gate.isAgentSpeaking()).toBe(false); // Exactly on expiration
  });

  it('getActiveToken returns correct token and handles expiration', () => {
    expect(gate.getActiveToken()).toBeNull();
    
    const token = gate.tryGrant(mockProposal);
    expect(gate.getActiveToken()).toBe(token);
    
    currentTime += config.speakingTimeoutMs;
    expect(gate.getActiveToken()).toBeNull();
  });

  it('onSpeechComplete clears the active token', () => {
    const token = gate.tryGrant(mockProposal);
    expect(gate.isAgentSpeaking()).toBe(true);
    
    gate.onSpeechComplete(token!.tokenId);
    expect(gate.isAgentSpeaking()).toBe(false);
  });
  
  it('onSpeechComplete does nothing if wrong token id provided', () => {
    const token = gate.tryGrant(mockProposal);
    gate.onSpeechComplete('wrong-token');
    expect(gate.isAgentSpeaking()).toBe(true);
  });

  it('revoke force-clears the active token', () => {
    const token = gate.tryGrant(mockProposal);
    gate.revoke(token!.tokenId);
    expect(gate.isAgentSpeaking()).toBe(false);
  });
});
