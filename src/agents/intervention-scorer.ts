import { IAgentProposal, IContextSnapshot } from "@shared/types";

export interface IUrgeParams {
  proposal: IAgentProposal;
  context: IContextSnapshot;
  history: IAgentProposal[];
}

export class InterventionScorer {
  calculateUrge(_params: IUrgeParams): number {
    return 0;
  }
  calculateNovelty(_proposed: string, _history: IAgentProposal[]): number {
    return 1;
  }
}
