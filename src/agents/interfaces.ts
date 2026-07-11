import {
  IContextSnapshot,
  ISemanticDelta,
  IBlackboardState,
  IAgentResult,
  IAgentProposal,
  IAgentResponse,
} from "@shared/types";

/**
 * Dependency-injected LLM client interface.
 * Implementations wrap the actual API (Gemini, OpenAI, etc.).
 */
export interface ILlmClient {
  /**
   * Send a prompt to the LLM and return the raw text response.
   * Implementations handle serialization, retries, and error mapping.
   */
  generate(prompt: string): Promise<string>;
}

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
