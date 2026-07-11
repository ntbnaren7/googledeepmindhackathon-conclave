import { GoogleGenAI } from '@google/genai';
import { ILlmClient } from './interfaces';
import { logger } from '../shared/logger';

export class GeminiLlmClient implements ILlmClient {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string = 'gemini-1.5-pro'
  ) {
    if (!apiKey) {
      logger.warn('GeminiLlmClient initialized without an API key.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string): Promise<string> {
    try {
      logger.debug('Sending prompt to Gemini API', { model: this.model });
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      if (!response.text) {
        throw new Error('Received empty text response from Gemini');
      }

      return response.text;
    } catch (error) {
      logger.error('Error generating content from Gemini', { error: String(error) });
      throw error;
    }
  }
}
