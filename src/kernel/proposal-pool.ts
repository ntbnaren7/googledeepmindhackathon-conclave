/**
 * @deprecated This class is no longer used by the Cognitive Kernel.
 * Arbitration directly processes arrays of IAgentProposal.
 * This file will be removed in a future cleanup PR.
 */
export class ProposalPool {
  private proposals: any[] = [];
  submit(p: any) { this.proposals.push(p); }
  flush() { const res = this.proposals; this.proposals = []; return res; }
}
