/**
 * Sync lexical matcher for the context world model.
 *
 * The Semantic Compressor assigns fresh ids to entities every turn, so id
 * equality alone lets duplicate decisions/risks/assumptions accumulate. This
 * matcher lets trackers collapse near-duplicate content into a single entity,
 * and lets the engine link objection/agreement units to the decision they
 * reference. It is deliberately dependency-free and synchronous so it can run
 * inside `ContextEngine.handleDelta` without awaiting an embedding API.
 *
 * `src/shared/similarity.ts` (cosine over numeric vectors) is left for a future
 * embedding-based upgrade.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'our', 'was', 'are', 'will', 'with', 'that', 'this',
  'too', 'not', 'but', 'you', 'your', 'have', 'has', 'its', 'into', 'from',
  'should', 'would', 'could', 'a', 'an', 'to', 'of', 'is', 'it', 'we', 'be',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Overlap coefficient: shared tokens divided by the size of the smaller token
 * set. Returns 0 when either side has no significant tokens.
 */
export function similarityScore(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const token of setA) {
    if (setB.has(token)) shared += 1;
  }
  return shared / Math.min(setA.size, setB.size);
}

/**
 * Returns the index of the candidate whose text best matches `text`, provided
 * the best score clears `threshold`. Returns -1 when nothing qualifies.
 */
export function bestMatchIndex<T>(
  text: string,
  candidates: readonly T[],
  getText: (candidate: T) => string,
  threshold = 0.5,
): number {
  let bestIndex = -1;
  let bestScore = threshold;

  for (let index = 0; index < candidates.length; index += 1) {
    const score = similarityScore(text, getText(candidates[index]));
    if (score >= bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}
