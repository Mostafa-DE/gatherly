import type { BracketEntry } from "./types"

/**
 * Pad entries to the next power of two with null/bye entries.
 */
export function padToPowerOfTwo(entries: BracketEntry[]): (BracketEntry | null)[] {
  const n = entries.length
  if (n === 0) return []
  let size = 1
  while (size < n) size *= 2
  const padded: (BracketEntry | null)[] = [...entries]
  while (padded.length < size) padded.push(null)
  return padded
}

/**
 * Standard seed placement for single elimination brackets.
 * Places seeds so that seed 1 meets seed 2 only in the final.
 *
 * For a bracket of size N, returns an array of length N where
 * index i holds the seed number that should be placed at position i.
 */
export function standardSeedPlacement(size: number): number[] {
  if (size === 1) return [1]
  if (size === 2) return [1, 2]

  const result: number[] = [1, 2]

  let currentSize = 2
  while (currentSize < size) {
    const nextSize = currentSize * 2
    const expanded: number[] = []
    for (const seed of result) {
      expanded.push(seed)
      expanded.push(nextSize + 1 - seed)
    }
    currentSize = nextSize
    result.length = 0
    result.push(...expanded)
  }

  return result
}

/**
 * Place entries into bracket positions using standard seeding.
 * Returns array of (BracketEntry | null) in bracket position order.
 */
export function placeSeeds(entries: BracketEntry[]): (BracketEntry | null)[] {
  const padded = padToPowerOfTwo(entries)
  const size = padded.length
  const placement = standardSeedPlacement(size)

  // Sort entries by seed
  const sorted = [...entries].sort((a, b) => a.seed - b.seed)
  const entryBySeed = new Map<number, BracketEntry>()
  for (const entry of sorted) {
    entryBySeed.set(entry.seed, entry)
  }

  const result: (BracketEntry | null)[] = new Array(size).fill(null)
  for (let i = 0; i < size; i++) {
    const seed = placement[i]
    result[i] = entryBySeed.get(seed) ?? null
  }

  return result
}

/**
 * Snake draft: distribute entries across groups in snake order.
 * Used for group stage seeding.
 */
export function snakeDraft<T>(entries: T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => [])
  let forward = true

  for (let i = 0; i < entries.length; ) {
    if (forward) {
      for (let g = 0; g < groupCount && i < entries.length; g++, i++) {
        groups[g].push(entries[i])
      }
    } else {
      for (let g = groupCount - 1; g >= 0 && i < entries.length; g--, i++) {
        groups[g].push(entries[i])
      }
    }
    forward = !forward
  }

  return groups
}

/**
 * Fisher-Yates shuffle with seeded PRNG for deterministic shuffling.
 */
export function shuffleSeeds(entries: BracketEntry[], seed: number): BracketEntry[] {
  const result = [...entries]
  let state = seed | 0

  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }

  // Reassign seeds based on new order
  return result.map((entry, idx) => ({
    ...entry,
    seed: idx + 1,
  }))
}
