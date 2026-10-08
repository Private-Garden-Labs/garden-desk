const RANK_DEPTH = 40;
const FUSION_OFFSET = 60;
const QUERY_WORDS = 64;

export interface SectionVectors {
  sectionIds: Int32Array;
  values: Float32Array;
}

export function keywordQuery(text: string): string | undefined {
  const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (words.length === 0) return undefined;
  return words
    .slice(0, QUERY_WORDS)
    .map((word) => `"${word}"`)
    .join(" OR ");
}

export function vectorRanks(vectors: SectionVectors, query: Float32Array): number[] {
  const best = new Map<number, number>();
  const dimensions = query.length;
  for (let row = 0; row < vectors.sectionIds.length; row += 1) {
    let score = 0;
    const offset = row * dimensions;
    for (let index = 0; index < dimensions; index += 1)
      score += (vectors.values[offset + index] ?? 0) * (query[index] ?? 0);
    const id = vectors.sectionIds[row] ?? 0;
    if (score > (best.get(id) ?? Number.NEGATIVE_INFINITY)) best.set(id, score);
  }
  return [...best]
    .sort((left, right) => right[1] - left[1])
    .slice(0, RANK_DEPTH)
    .map(([id]) => id);
}

/** Reciprocal rank fusion: a section ranked high by either search ranks high overall. */
export function fuseRanks(rankings: readonly number[][]): number[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings)
    ranking.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (FUSION_OFFSET + rank));
    });
  return [...scores].sort((left, right) => right[1] - left[1]).map(([id]) => id);
}

/** Takes each passage's best sections first, so every clause of a document gets its match. */
export function interleave(rankings: readonly number[][], limit: number): number[] {
  const picked = new Set<number>();
  for (let rank = 0; rank < RANK_DEPTH; rank += 1)
    for (const ranking of rankings) {
      const id = ranking[rank];
      if (id !== undefined) picked.add(id);
    }
  return [...picked].slice(0, limit);
}

export function documentPassages(text: string, count: number): string[] {
  const size = Math.max(300, Math.ceil(text.length / count));
  const passages: string[] = [];
  let current = "";
  for (const line of text.split(/\r?\n/u)) {
    current = current.length === 0 ? line : `${current}\n${line}`;
    if (current.length >= size) {
      passages.push(current);
      current = "";
    }
  }
  if (current.trim().length > 0) passages.push(current);
  return passages.filter((passage) => passage.trim().length > 0).slice(0, count);
}
