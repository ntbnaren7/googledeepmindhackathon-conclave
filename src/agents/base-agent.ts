import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
} from "@shared/types";
import { IStakeholderAgent } from "./interfaces";

export abstract class BaseAgent implements IStakeholderAgent {
  abstract id: string;
  abstract role: string;
  abstract responsibilities: string[];

  async evaluate(
    _snapshot: IContextSnapshot,
    _delta: ISemanticDelta,
    _blackboard: IBlackboardState,
  ): Promise<IAgentResult> {
    return { proposal: null, blackboardEntries: [] };
  }

  async generateResponse(
    _snapshot: IContextSnapshot,
    _proposal: IAgentProposal,
  ): Promise<IAgentResponse> {
    return { content: "", tone: "neutral" };
  }

  reset(): void {}
}
