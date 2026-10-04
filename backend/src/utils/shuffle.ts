/**
 * One Fisher–Yates implementation, two entry points.
 *
 * `shuffle` gives a fresh random order on every call, which suits a playlist by
 * mood: reopening it should not feel frozen. `seededShuffle` gives a stable
 * order for a given seed, which feeds need so the same user sees the same page
 * within a refresh window.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Linear congruential step — cheap and good enough for shuffling. */
function nextSeed(seed: number): number {
  return ((seed * 1103515245 + 12345) & 0x7fffffff) >>> 0;
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = nextSeed(s);
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
