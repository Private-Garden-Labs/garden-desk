import { DatabaseSync } from "node:sqlite";
import {
  type Jurisdiction,
  JurisdictionSchema,
  type LawJurisdictionSummary,
} from "@gardendesk/shared";
import { promptDirectoryExists, readPromptFile, writePromptFile } from "../prompt-files.js";
import {
  documentPassages,
  fuseRanks,
  interleave,
  keywordQuery,
  type SectionVectors,
  vectorRanks,
} from "./law-search.js";

const QUERY_INSTRUCTION =
  "Instruct: Given a contract clause or legal question, retrieve the law sections that govern it\nQuery: ";
const QUERY_CHARACTERS = 1_000;
const SEARCH_RESULTS = 5;
const DOCUMENT_PASSAGES = 24;
const DOCUMENT_RESULTS = 16;
const SECTION_CHARACTERS = 2_500;

export interface LawSection {
  citation: string;
  heading: string;
  source: string;
  text: string;
}

export interface LawContext {
  name: string;
  currentAsOf: string;
  search(query: string, signal?: AbortSignal): Promise<LawSection[]>;
  forDocument(text: string, signal?: AbortSignal): Promise<LawSection[]>;
}

export type Embed = (text: string, signal?: AbortSignal) => Promise<number[]>;

type JurisdictionRow = { id: string; name: string; current_as_of: string };

export class LawLibrary {
  private database: DatabaseSync | undefined;
  private readonly vectors = new Map<Jurisdiction, SectionVectors>();
  constructor(
    private readonly path: string,
    private readonly settingsPath: string,
    private readonly embed: Embed,
  ) {}

  list(): LawJurisdictionSummary[] {
    const database = this.open();
    if (database === undefined) return [];
    const disabled = this.disabled();
    const rows = database
      .prepare("SELECT id, name, current_as_of FROM jurisdictions ORDER BY rowid")
      .all() as JurisdictionRow[];
    const sources = database.prepare(
      "SELECT title, version FROM sources WHERE jurisdiction = ? ORDER BY position",
    );
    return rows.map((row) => ({
      id: JurisdictionSchema.parse(row.id),
      name: row.name,
      currentAsOf: row.current_as_of,
      enabled: !disabled.has(row.id),
      sources: sources.all(row.id) as LawJurisdictionSummary["sources"],
    }));
  }

  setEnabled(id: Jurisdiction, enabled: boolean): boolean {
    const disabled = this.disabled();
    if (enabled) disabled.delete(id);
    else disabled.add(id);
    writePromptFile(this.settingsPath, `${JSON.stringify({ disabled: [...disabled].sort() })}\n`);
    return true;
  }

  context(id: Jurisdiction): LawContext {
    const jurisdiction = this.list().find((item) => item.id === id && item.enabled);
    if (jurisdiction === undefined) throw new Error("law_jurisdiction_unavailable");
    return {
      name: jurisdiction.name,
      currentAsOf: jurisdiction.currentAsOf,
      search: async (query, signal) =>
        this.sections((await this.rank(id, query, signal)).slice(0, SEARCH_RESULTS)),
      forDocument: async (text, signal) => {
        const rankings: number[][] = [];
        for (const passage of documentPassages(text, DOCUMENT_PASSAGES))
          rankings.push(await this.rank(id, passage, signal));
        return this.sections(interleave(rankings, 2, DOCUMENT_RESULTS));
      },
    };
  }

  private async rank(id: Jurisdiction, text: string, signal?: AbortSignal): Promise<number[]> {
    const query = text.slice(0, QUERY_CHARACTERS);
    const vector = await this.embed(`${QUERY_INSTRUCTION}${query}`, signal);
    return fuseRanks([
      this.keywordRanks(id, query),
      vectorRanks(this.sectionVectors(id), Float32Array.from(vector)),
    ]);
  }

  private keywordRanks(id: Jurisdiction, text: string): number[] {
    const query = keywordQuery(text);
    if (query === undefined) return [];
    const rows = this.required()
      .prepare(
        `SELECT sections_fts.rowid AS id FROM sections_fts
         JOIN sections ON sections.id = sections_fts.rowid
         WHERE sections_fts MATCH ? AND sections.jurisdiction = ?
         ORDER BY bm25(sections_fts, 10.0, 4.0, 2.0, 1.0) LIMIT 40`,
      )
      .all(query, id) as Array<{ id: number }>;
    return rows.map((row) => row.id);
  }

  private sectionVectors(id: Jurisdiction): SectionVectors {
    const cached = this.vectors.get(id);
    if (cached !== undefined) return cached;
    const rows = this.required()
      .prepare(
        `SELECT chunks.section_id AS id, chunks.vector AS vector FROM chunks
         JOIN sections ON sections.id = chunks.section_id WHERE sections.jurisdiction = ?`,
      )
      .all(id) as Array<{ id: number; vector: Uint8Array }>;
    const dimensions = (rows[0]?.vector.byteLength ?? 0) / 4;
    const values = new Float32Array(rows.length * dimensions);
    rows.forEach((row, index) => {
      values.set(new Float32Array(Uint8Array.from(row.vector).buffer), index * dimensions);
    });
    const vectors = { sectionIds: Int32Array.from(rows, (row) => row.id), values };
    this.vectors.set(id, vectors);
    return vectors;
  }

  private sections(ids: readonly number[]): LawSection[] {
    const statement = this.required().prepare(
      `SELECT sections.citation, sections.heading, sources.title AS source, sections.text
       FROM sections JOIN sources ON sources.id = sections.source_id WHERE sections.id = ?`,
    );
    return ids.map((id) => {
      const section = statement.get(id) as unknown as LawSection;
      const text =
        section.text.length > SECTION_CHARACTERS
          ? `${section.text.slice(0, SECTION_CHARACTERS)} [section continues]`
          : section.text;
      return { ...section, text };
    });
  }

  private open(): DatabaseSync | undefined {
    if (this.database === undefined && promptDirectoryExists(this.path))
      this.database = new DatabaseSync(this.path, { readOnly: true, allowExtension: false });
    return this.database;
  }

  private required(): DatabaseSync {
    const database = this.open();
    if (database === undefined) throw new Error("law_library_unavailable");
    return database;
  }

  private disabled(): Set<string> {
    if (!promptDirectoryExists(this.settingsPath)) return new Set();
    const parsed = JSON.parse(readPromptFile(this.settingsPath)) as { disabled?: unknown };
    return new Set(Array.isArray(parsed.disabled) ? parsed.disabled.map(String) : []);
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }
}
