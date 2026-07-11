import { IAttentionGate, ITimeProvider, SpeakingToken } from './interfaces';
import { InterventionProposal } from '../shared/types';
import crypto from 'crypto';

export class AttentionGate implements IAttentionGate {
  private activeToken: SpeakingToken | null = null;

  constructor(
    private readonly config: { readonly speakingTimeoutMs: number },
    private readonly timeProvider: ITimeProvider
  ) {}

  tryGrant(proposal: InterventionProposal): SpeakingToken | null {
    const now = this.timeProvider.now();

    if (this.activeToken !== null) {
      if (now >= this.activeToken.expiresAt) {
        this.activeToken = null; // Auto-revoke expired token
      } else {
        return null; // Another agent is speaking
      }
    }

    const token: SpeakingToken = Object.freeze({
      tokenId: crypto.randomUUID(),
      agentId: proposal.agentId,
      proposalId: proposal.id,
      grantedAt: now,
      expiresAt: now + this.config.speakingTimeoutMs,
    });

    this.activeToken = token;
    return token;
  }

  revoke(tokenId: string): void {
    if (this.activeToken && this.activeToken.tokenId === tokenId) {
      this.activeToken = null;
    }
  }

  isAgentSpeaking(): boolean {
    const now = this.timeProvider.now();
    if (this.activeToken === null) {
      return false;
    }
    if (now >= this.activeToken.expiresAt) {
      this.activeToken = null; // Side effect: Auto-revoke expired token
      return false;
    }
    return true;
  }

  getActiveToken(): SpeakingToken | null {
    const now = this.timeProvider.now();
    if (this.activeToken === null) {
      return null;
    }
    if (now >= this.activeToken.expiresAt) {
      this.activeToken = null; // Side effect: Auto-revoke expired token
      return null;
    }
    return this.activeToken;
  }

  onSpeechComplete(tokenId: string): void {
    if (this.activeToken && this.activeToken.tokenId === tokenId) {
      this.activeToken = null;
    }
  }
}
