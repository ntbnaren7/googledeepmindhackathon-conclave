import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../../../src/shared/similarity';

describe('cosineSimilarity', () => {
  it('should calculate identical vectors as 1', () => {
    const v1 = [1, 2, 3];
    const v2 = [1, 2, 3];
    // Due to float math, check close to 1
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
  });

  it('should calculate orthogonal vectors as 0', () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });

  it('should protect against zero vectors', () => {
    const v1 = [0, 0, 0];
    const v2 = [1, 2, 3];
    expect(cosineSimilarity(v1, v2)).toBe(0);
    expect(cosineSimilarity(v2, v1)).toBe(0);
    expect(cosineSimilarity(v1, v1)).toBe(0);
  });

  it('should calculate known vectors correctly', () => {
    const v1 = [1, 1];
    const v2 = [-1, -1];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0);
  });

  it('should throw if vectors are unequal length', () => {
    const v1 = [1, 2];
    const v2 = [1, 2, 3];
    expect(() => cosineSimilarity(v1, v2)).toThrow();
  });
});