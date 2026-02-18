// Pure functions for variety penalty — zero external dependencies

export type PenaltyMatrix = Map<string, number>

const DEFAULT_MAX_LOOKBACK = 10

/**
 * Canonical key for a pair of user IDs (sorted lexically).
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/**
 * Build a penalty matrix from co-occurrence counts.
 * penalty = min(count / maxLookback, 1)
 * A pair that has been grouped together in all lookback runs gets penalty 1.
 */
export function buildPenaltyMatrix(
  cooccurrences: Map<string, number>,
  maxLookback = DEFAULT_MAX_LOOKBACK
): PenaltyMatrix {
  const matrix: PenaltyMatrix = new Map()

  for (const [key, count] of cooccurrences) {
    matrix.set(key, Math.min(count / maxLookback, 1))
  }

  return matrix
}

/**
 * Get the variety penalty for a pair of users.
 * Returns 0 for unknown pairs (never co-grouped).
 */
export function getPenalty(
  matrix: PenaltyMatrix,
  userA: string,
  userB: string
): number {
  return matrix.get(pairKey(userA, userB)) ?? 0
}
