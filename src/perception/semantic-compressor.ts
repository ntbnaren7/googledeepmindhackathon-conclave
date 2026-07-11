import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type { ISemanticCompressor } from './interfaces';
import type { TranscriptSegment } from './types';
import type {
  IAssumption,
  IDecision,
  IRisk,
  ISemanticUnit,
  ITopic,
  SemanticDelta,
} from '@shared/types';
import { logger } from '@shared/logger';

export interface SemanticCompressionClient {
  generate(prompt: string): Promise<unknown>;
}

export interface SemanticCompressorOptions {
  apiKey?: string;
  model?: string;
  client?: SemanticCompressionClient;
}

const DEFAULT_MODEL = 'gemini-1.5-pro';

export class SemanticCompressor implements ISemanticCompressor {
  private readonly client: SemanticCompressionClient | null;

  constructor(options: SemanticCompressorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.client = options.client ?? (apiKey ? new GeminiCompressionClient(apiKey, model) : null);
  }

  async compress(segments: TranscriptSegment[]): Promise<SemanticDelta> {
    const normalizedSegments = segments
      .map((segment) => ({ ...segment, text: segment.text.trim() }))
      .filter((segment) => segment.text !== '');

    if (normalizedSegments.length === 0 || !this.client) return emptySemanticDelta();

    try {
      const modelOutput = await this.client.generate(this.buildPrompt(normalizedSegments));
      return normalizeSemanticDelta(modelOutput);
    } catch (error) {
      logger.warn('[semantic-compressor] compression failed', { error: String(error) });
      return emptySemanticDelta();
    }
  }

  private buildPrompt(segments: TranscriptSegment[]): string {
    return [
      'Compress these transcript segments into a Conclave SemanticDelta.',
      'Return only valid JSON with this exact shape:',
      '{"units":[{"id":"string","speakerId":"string","content":"string","timestamp":0}],"topics":[{"id":"string","label":"string","confidence":0}],"decisions":[{"id":"string","description":"string","status":"proposed|approved|rejected","timestamp":0}],"assumptions":[{"id":"string","statement":"string","challenged":false}],"risks":[{"id":"string","description":"string","severity":0}]}',
      'Use the provided segment id for each unit id and segment startMs for unit timestamp.',
      'Keep risk severity between 0 and 1.',
      JSON.stringify({
        segments: segments.map((segment) => ({
          id: segment.id,
          speakerId: segment.speaker.id,
          speakerLabel: segment.speaker.label,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
          confidence: segment.confidence,
        })),
      }),
    ].join('\n');
  }
}

class GeminiCompressionClient implements SemanticCompressionClient {
  private readonly model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    const ai = new GoogleGenerativeAI(apiKey);
    this.model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
  }

  async generate(prompt: string): Promise<unknown> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

function normalizeSemanticDelta(modelOutput: unknown): SemanticDelta {
  const parsedOutput = parseModelOutput(modelOutput);

  return {
    units: readArray(parsedOutput, 'units').flatMap(normalizeUnit),
    topics: readArray(parsedOutput, 'topics').flatMap(normalizeTopic),
    decisions: readArray(parsedOutput, 'decisions').flatMap(normalizeDecision),
    assumptions: readArray(parsedOutput, 'assumptions').flatMap(normalizeAssumption),
    risks: readArray(parsedOutput, 'risks').flatMap(normalizeRisk),
  };
}

function parseModelOutput(modelOutput: unknown): unknown {
  if (typeof modelOutput !== 'string') return modelOutput;

  const trimmedOutput = modelOutput.trim();
  const fencedMatch = trimmedOutput.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch?.[1]?.trim() ?? extractJsonObject(trimmedOutput);

  try {
    return JSON.parse(jsonText);
  } catch {
    return {};
  }
}

function extractJsonObject(text: string): string {
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');

  if (startIndex >= 0 && endIndex >= startIndex) {
    return text.slice(startIndex, endIndex + 1);
  }

  return text;
}

function readArray(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function normalizeUnit(value: unknown): ISemanticUnit[] {
  if (!isRecord(value)) return [];

  const id = readString(value.id);
  const speakerId = readString(value.speakerId);
  const content = readString(value.content);
  const timestamp = readFiniteNumber(value.timestamp);

  if (!id || !speakerId || !content || timestamp === null) return [];

  return [{ id, speakerId, content, timestamp }];
}

function normalizeTopic(value: unknown): ITopic[] {
  if (!isRecord(value)) return [];

  const id = readString(value.id);
  const label = readString(value.label);
  const confidence = readFiniteNumber(value.confidence);

  if (!id || !label || confidence === null) return [];

  return [{ id, label, confidence: clamp01(confidence) }];
}

function normalizeDecision(value: unknown): IDecision[] {
  if (!isRecord(value)) return [];

  const id = readString(value.id);
  const description = readString(value.description);
  const status = readDecisionStatus(value.status);
  const timestamp = readFiniteNumber(value.timestamp);

  if (!id || !description || !status || timestamp === null) return [];

  return [{ id, description, status, timestamp }];
}

function normalizeAssumption(value: unknown): IAssumption[] {
  if (!isRecord(value)) return [];

  const id = readString(value.id);
  const statement = readString(value.statement);

  if (!id || !statement) return [];

  return [{ id, statement, challenged: value.challenged === true }];
}

function normalizeRisk(value: unknown): IRisk[] {
  if (!isRecord(value)) return [];

  const id = readString(value.id);
  const description = readString(value.description);
  const severity = readFiniteNumber(value.severity);

  if (!id || !description || severity === null) return [];

  return [{ id, description, severity: clamp01(severity) }];
}

function readDecisionStatus(value: unknown): IDecision['status'] | null {
  if (value === 'proposed' || value === 'approved' || value === 'rejected') {
    return value;
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function emptySemanticDelta(): SemanticDelta {
  return {
    units: [],
    topics: [],
    decisions: [],
    assumptions: [],
    risks: [],
  };
}
