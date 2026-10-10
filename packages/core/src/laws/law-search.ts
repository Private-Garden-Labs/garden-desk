const RANK_DEPTH = 40;
const FUSION_OFFSET = 5;
const QUERY_WORDS = 64;
const CHUNK_CHARACTERS = 1_500;
const CLAUSE_CHARACTERS = 60;

export interface SectionVectors {
  sectionIds: Int32Array;
  chunkIndexes: Int32Array;
  values: Float32Array;
}

/** Section ids, best first, and the index of each section's best-matching chunk. */
export interface Ranking {
  ids: number[];
  chunks: Map<number, number>;
}

function splitLong(paragraph: string): string[] {
  const pieces: string[] = [];
  let rest = paragraph;
  while (rest.length > CHUNK_CHARACTERS) {
    const cut = rest.lastIndexOf(" ", CHUNK_CHARACTERS);
    const end = cut > 0 ? cut : CHUNK_CHARACTERS;
    pieces.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  return [...pieces, rest];
}

/** Chunks of at most 1,500 characters, split at paragraph boundaries where possible. */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split("\n").flatMap(splitLong)) {
    if (current !== "" && current.length + 1 + paragraph.length > CHUNK_CHARACTERS) {
      chunks.push(current);
      current = "";
    }
    current = current === "" ? paragraph : `${current}\n${paragraph}`;
  }
  return current === "" ? chunks : [...chunks, current];
}

/** Shows a long section from the chunk that matched, so the reader sees the rule the search found. */
export function sectionExcerpt(text: string, chunk: number, limit: number): string {
  if (text.length <= limit) return text;
  const shown = chunkText(text).slice(chunk).join("\n");
  const omitted = chunk > 0 ? "[earlier text omitted]\n" : "";
  const continues = shown.length > limit ? " [section continues]" : "";
  return `${omitted}${shown.slice(0, limit)}${continues}`;
}

export function keywordQuery(text: string): string | undefined {
  const words = [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (words.length === 0) return undefined;
  return words
    .slice(0, QUERY_WORDS)
    .map((word) => `"${word}"`)
    .join(" OR ");
}

export function vectorRanks(vectors: SectionVectors, query: Float32Array): Ranking {
  const best = new Map<number, { score: number; chunk: number }>();
  const dimensions = query.length;
  for (let row = 0; row < vectors.sectionIds.length; row += 1) {
    let score = 0;
    const offset = row * dimensions;
    for (let index = 0; index < dimensions; index += 1)
      score += (vectors.values[offset + index] ?? 0) * (query[index] ?? 0);
    const id = vectors.sectionIds[row] ?? 0;
    if (score > (best.get(id)?.score ?? Number.NEGATIVE_INFINITY))
      best.set(id, { score, chunk: vectors.chunkIndexes[row] ?? 0 });
  }
  return {
    ids: [...best]
      .sort((left, right) => right[1].score - left[1].score)
      .slice(0, RANK_DEPTH)
      .map(([id]) => id),
    chunks: new Map([...best].map(([id, match]) => [id, match.chunk])),
  };
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

/**
 * Takes each passage's best sections first, so every clause of a document gets its match.
 * Returns [section id, chunk] pairs; a long section appears once per part that matched.
 */
export function interleave(rankings: readonly Ranking[], limit: number): Array<[number, number]> {
  const picked = new Map<string, [number, number]>();
  for (let rank = 0; rank < RANK_DEPTH; rank += 1)
    for (const ranking of rankings) {
      const id = ranking.ids[rank];
      if (id === undefined || picked.size >= limit) continue;
      const chunk = ranking.chunks.get(id) ?? 0;
      picked.set(`${id}:${chunk}`, [id, chunk]);
    }
  return [...picked.values()];
}

function clauses(text: string): string[] {
  const found: string[] = [];
  let current = "";
  for (const line of text
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)) {
    current = current.length === 0 ? line : `${current}\n${line}`;
    if (line.length >= CLAUSE_CHARACTERS) {
      found.push(current);
      current = "";
    }
  }
  return current.length === 0 ? found : [...found, current];
}

/** One passage per clause, with a heading joined to the next line; a long document is merged into `count` passages. */
export function documentPassages(text: string, count: number): string[] {
  const units = clauses(text);
  if (units.length <= count) return units;
  const size = Math.ceil(text.length / count);
  const passages: string[] = [];
  let current = "";
  for (const unit of units) {
    current = current.length === 0 ? unit : `${current}\n${unit}`;
    if (current.length >= size) {
      passages.push(current);
      current = "";
    }
  }
  if (current.length > 0) passages.push(current);
  return passages.slice(0, count);
}
