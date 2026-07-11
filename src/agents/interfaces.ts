import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
} from "@shared/types";

export interface IStakeholderAgent {
  readonly id: string;
  readonly role: string;
  readonly responsibilities: string[];
  evaluate(
    snapshot: IContextSnapshot,
    delta: ISemanticDelta,
    blackboard: IBlackboardState,
  ): Promise<IAgentResult>;
  generateResponse(
    snapshot: IContextSnapshot,
    proposal: IAgentProposal,
  ): Promise<IAgentResponse>;
  reset(): void;
}
