import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type Jurisdiction,
  JurisdictionSchema,
  LAW_PACK_DIRECTORIES,
  type LawJurisdictionSummary,
} from "@gardendesk/shared";
import { promptDirectoryExists, readPromptFile, writePromptFile } from "../prompt-files.js";
import {
  documentPassages,
  fuseRanks,
  interleave,
  keywordQuery,
  type Ranking,
  type SectionVectors,
  sectionExcerpt,
  vectorRanks,
} from "./law-search.js";

const QUERY_INSTRUCTION =
  "Instruct: Given a contract provision, retrieve statutory rights, duties and prohibitions that determine whether it is enforceable\nQuery: ";
const QUERY_CHARACTERS = 1_000;
const SEARCH_RESULTS = 5;
const DOCUMENT_PASSAGES = 24;
const SECTION_CHARACTERS = 4_000;
const DOCUMENT_SECTION_CHARACTERS = 2_000;
const DOCUMENT_LAW_CHARACTERS = 48_000;

export interface LawSection {
  citation: string;
  heading: string;
  source: string;
  text: string;
}

export interface LawContext {
  name: string;
  currentAsOf: string;
  searched(): boolean;
  search(query: string, signal?: AbortSignal): Promise<LawSection[]>;
  forDocument(text: string, signal?: AbortSignal): Promise<LawSection[]>;
}

export type Embed = (text: string, signal?: AbortSignal) => Promise<number[]>;

type JurisdictionRow = { id: string; name: string; current_as_of: string };
type Settings = { disabled: string[]; disabledSources: string[] };

function toggled(values: string[], value: string, enabled: boolean): string[] {
  const kept = values.filter((item) => item !== value);
  return (enabled ? kept : [...kept, value]).sort();
}

function withinCharacters(sections: LawSection[], limit: number): LawSection[] {
  const kept: LawSection[] = [];
  let used = 0;
  for (const section of sections) {
    used += section.text.length;
    if (used > limit) break;
    kept.push(section);
  }
  return kept;
}

export class LawLibrary {
  private readonly databases = new Map<Jurisdiction, DatabaseSync>();
  private readonly vectors = new Map<Jurisdiction, SectionVectors>();
  constructor(
    private readonly path: string,
    private readonly settingsPath: string,
    private readonly embed: Embed,
  ) {}

  list(): LawJurisdictionSummary[] {
    const { disabled, disabledSources } = this.settings();
    return JurisdictionSchema.options.flatMap((id) => {
      const database = this.open(id);
      if (database === undefined) return [];
      const row = database
        .prepare("SELECT id, name, current_as_of FROM jurisdictions WHERE id = ?")
        .get(id) as JurisdictionRow;
      const sources = database
        .prepare("SELECT id, title, version FROM sources WHERE jurisdiction = ? ORDER BY position")
        .all(id) as Array<{ id: string; title: string; version: string }>;
      return [
        {
          id,
          name: row.name,
          currentAsOf: row.current_as_of,
          enabled: !disabled.includes(id),
          sources: sources.map((source) => ({
            ...source,
            enabled: !disabledSources.includes(source.id),
          })),
        },
      ];
    });
  }

  setEnabled(id: Jurisdiction, enabled: boolean, source?: string): boolean {
    const settings = this.settings();
    if (source === undefined) {
      settings.disabled = toggled(settings.disabled, id, enabled);
    } else {
      const known = this.list().some(
        (law) => law.id === id && law.sources.some((item) => item.id === source),
      );
      if (!known) return false;
      settings.disabledSources = toggled(settings.disabledSources, source, enabled);
      this.vectors.delete(id);
    }
    writePromptFile(this.settingsPath, `${JSON.stringify(settings)}\n`);
    return true;
  }

  context(id: Jurisdiction): LawContext {
    const jurisdiction = this.list().find((item) => item.id === id && item.enabled);
    if (jurisdiction === undefined) throw new Error("law_jurisdiction_unavailable");
    let searched = false;
    return {
      name: jurisdiction.name,
      currentAsOf: jurisdiction.currentAsOf,
      searched: () => searched,
      search: async (query, signal) => {
        searched = true;
        return this.sections(
          id,
          interleave([await this.rank(id, query, signal)]).slice(0, SEARCH_RESULTS),
          SECTION_CHARACTERS,
        );
      },
      forDocument: async (text, signal) => {
        searched = true;
        const rankings: Ranking[] = [];
        for (const passage of documentPassages(text, DOCUMENT_PASSAGES))
          rankings.push(await this.meaningRanks(id, passage, signal));
        return withinCharacters(
          this.sections(id, interleave(rankings), DOCUMENT_SECTION_CHARACTERS),
          DOCUMENT_LAW_CHARACTERS,
        );
      },
    };
  }

  private async rank(id: Jurisdiction, text: string, signal?: AbortSignal): Promise<Ranking> {
    const meaning = await this.meaningRanks(id, text, signal);
    return {
      ids: fuseRanks([this.keywordRanks(id, text.slice(0, QUERY_CHARACTERS)), meaning.ids]),
      chunks: meaning.chunks,
    };
  }

  private async meaningRanks(
    id: Jurisdiction,
    text: string,
    signal?: AbortSignal,
  ): Promise<Ranking> {
    const vector = await this.embed(
      `${QUERY_INSTRUCTION}${text.slice(0, QUERY_CHARACTERS)}`,
      signal,
    );
    return vectorRanks(this.sectionVectors(id), Float32Array.from(vector));
  }

  private keywordRanks(id: Jurisdiction, text: string): number[] {
    const query = keywordQuery(text);
    if (query === undefined) return [];
    const rows = this.required(id)
      .prepare(
        `SELECT sections_fts.rowid AS id FROM sections_fts
         JOIN sections ON sections.id = sections_fts.rowid
         WHERE sections_fts MATCH ? AND sections.jurisdiction = ?
         AND sections.source_id NOT IN (SELECT value FROM json_each(?))
         ORDER BY bm25(sections_fts, 10.0, 4.0, 2.0, 1.0) LIMIT 40`,
      )
      .all(query, id, this.disabledSources()) as Array<{ id: number }>;
    return rows.map((row) => row.id);
  }

  private sectionVectors(id: Jurisdiction): SectionVectors {
    const cached = this.vectors.get(id);
    if (cached !== undefined) return cached;
    const rows = this.required(id)
      .prepare(
        `SELECT chunks.section_id AS id, chunks.vector AS vector FROM chunks
         JOIN sections ON sections.id = chunks.section_id WHERE sections.jurisdiction = ?
         AND sections.source_id NOT IN (SELECT value FROM json_each(?))
         ORDER BY chunks.rowid`,
      )
      .all(id, this.disabledSources()) as Array<{ id: number; vector: Uint8Array }>;
    const dimensions = (rows[0]?.vector.byteLength ?? 0) / 4;
    const values = new Float32Array(rows.length * dimensions);
    rows.forEach((row, index) => {
      values.set(new Float32Array(Uint8Array.from(row.vector).buffer), index * dimensions);
    });
    const counts = new Map<number, number>();
    const chunkIndexes = Int32Array.from(rows, (row) => {
      const index = counts.get(row.id) ?? 0;
      counts.set(row.id, index + 1);
      return index;
    });
    const vectors = { sectionIds: Int32Array.from(rows, (row) => row.id), chunkIndexes, values };
    this.vectors.set(id, vectors);
    return vectors;
  }

  private sections(
    id: Jurisdiction,
    picked: ReadonlyArray<[number, number]>,
    characters: number,
  ): LawSection[] {
    const statement = this.required(id).prepare(
      `SELECT sections.citation, sections.heading, sources.title AS source, sections.text
       FROM sections JOIN sources ON sources.id = sections.source_id WHERE sections.id = ?`,
    );
    return picked.map(([id, chunk]) => {
      const section = statement.get(id) as unknown as LawSection;
      return { ...section, text: sectionExcerpt(section.text, chunk, characters) };
    });
  }

  private open(id: Jurisdiction): DatabaseSync | undefined {
    const path = join(this.path, LAW_PACK_DIRECTORIES[id], "law-library.sqlite");
    if (!this.databases.has(id) && promptDirectoryExists(path))
      this.databases.set(id, new DatabaseSync(path, { readOnly: true, allowExtension: false }));
    return this.databases.get(id);
  }

  private required(id: Jurisdiction): DatabaseSync {
    const database = this.open(id);
    if (database === undefined) throw new Error("law_library_unavailable");
    return database;
  }

  private settings(): Settings {
    if (!promptDirectoryExists(this.settingsPath)) return { disabled: [], disabledSources: [] };
    const parsed = JSON.parse(readPromptFile(this.settingsPath)) as Record<string, unknown>;
    const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
    return { disabled: strings(parsed.disabled), disabledSources: strings(parsed.disabledSources) };
  }

  private disabledSources(): string {
    return JSON.stringify(this.settings().disabledSources);
  }

  close(): void {
    for (const database of this.databases.values()) database.close();
    this.databases.clear();
  }
}
