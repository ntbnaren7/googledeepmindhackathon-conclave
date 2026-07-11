import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { ILlmClient } from './interfaces';
import { loadConfig } from '../config';
import { logger } from '../shared/logger';

/**
 * Real Gemini-backed LLM client for stakeholder agents. Configured for JSON
 * output so the agents' `parseEvaluationOutput` / `parseResponseOutput` hooks
 * reliably extract their `{proposal, blackboardEntries}` / `{content, tone}`
 * shapes. On any API error it returns an empty string; BaseAgent treats that as
 * "no proposal" and keeps the cognitive loop alive.
 */
export class GeminiLlmClient implements ILlmClient {
  private readonly model: GenerativeModel;

  constructor(apiKey?: string, modelName?: string) {
    const cfg = loadConfig();
    const genAI = new GoogleGenerativeAI(apiKey ?? cfg.gemini.apiKey);
    this.model = genAI.getGenerativeModel({
      model: modelName ?? cfg.gemini.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });
  }

  async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.warn('[gemini-llm] generation failed', { error: String(error) });
      return '';
    }
  }
}
