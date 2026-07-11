export class ProposalPool {
  private proposals: any[] = [];
  submit(p: any) { this.proposals.push(p); }
  flush() { const res = this.proposals; this.proposals = []; return res; }
}
