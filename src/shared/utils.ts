/**
 * Shared utility functions.
 *
 * These are pure, stateless helpers with no domain knowledge.
 * Import via @shared/utils or directly.
 */

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extracts a JSON object from LLM output that may be wrapped in
 * markdown code fences, surrounded by prose, or malformed.
 *
 * Attempts three strategies in order:
 *   1. Parse the entire output as JSON
 *   2. Extract from a markdown code fence (```json ... ```)
 *   3. Find the outermost { ... } brace pair
 *
 * Returns null if no valid JSON is found.
 */
export function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;

  // Attempt 1 — the entire output is valid JSON
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // continue to next attempt
  }

  // Attempt 2 — JSON inside a markdown code fence (```json ... ```)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as Record<string, unknown>;
    } catch {
      // continue to next attempt
    }
  }

  // Attempt 3 — find the outermost { ... } brace pair
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as Record<string, unknown>;
    } catch {
      // no valid JSON found
    }
  }

  return null;
}
