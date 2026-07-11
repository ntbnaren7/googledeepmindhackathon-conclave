import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { ILlmClient } from "./interfaces";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the Gemini LLM client. */
export interface GeminiLlmClientConfig {
  /** Gemini API key. */
  apiKey: string;
  /** Model name (e.g., "gemini-1.5-pro"). */
  model?: string;
  /** Sampling temperature (0.0–2.0). Default: 0.7 for balanced reasoning. */
  temperature?: number;
  /** Maximum output tokens. Default: 2048. */
  maxOutputTokens?: number;
}

// ---------------------------------------------------------------------------
// GeminiLlmClient
// ---------------------------------------------------------------------------

/**
 * Production LLM client wrapping the Gemini API.
 *
 * Implements ILlmClient via dependency injection. BaseAgent and
 * all stakeholder agents depend only on the ILlmClient interface —
 * they have no knowledge of Gemini.
 *
 * This class is the only place in the Agents module that touches
 * the Google Generative AI SDK.
 */
export class GeminiLlmClient implements ILlmClient {
  private readonly model: GenerativeModel;

  constructor(config: GeminiLlmClientConfig) {
    const ai = new GoogleGenerativeAI(config.apiKey);
    this.model = ai.getGenerativeModel({
      model: config.model ?? "gemini-3.5-flash",
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
      },
    });
  }

  /**
   * Send a prompt to Gemini and return the raw text response.
   *
   * Returns the text content of the model's response. If the response
   * is empty or malformed, returns an empty string.
   */
  async generate(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    return text ?? "";
  }
}
