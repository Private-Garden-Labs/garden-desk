import { rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { INFERENCE_PROFILE } from "../../packages/shared/src/inference-profile.js";
import type { Jurisdiction, Section, Source } from "./sources.js";

export const encoderModelId = INFERENCE_PROFILE.encoderId;
export const dimensions = 1024;

const schema = `
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE jurisdictions (id TEXT PRIMARY KEY, name TEXT NOT NULL, current_as_of TEXT NOT NULL);
CREATE TABLE sources (id TEXT PRIMARY KEY, jurisdiction TEXT NOT NULL, title TEXT NOT NULL, version TEXT NOT NULL, url TEXT NOT NULL, sha256 TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE sections (id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, jurisdiction TEXT NOT NULL, citation TEXT NOT NULL, heading TEXT NOT NULL, text TEXT NOT NULL);
CREATE INDEX sections_jurisdiction ON sections(jurisdiction);
CREATE VIRTUAL TABLE sections_fts USING fts5(citation, heading, title, text, content='', tokenize='porter unicode61 remove_diacritics 2');
CREATE TABLE chunks (section_id INTEGER NOT NULL, vector BLOB NOT NULL);
CREATE INDEX chunks_section ON chunks(section_id);
`;

export async function createLibrary(path: string): Promise<DatabaseSync> {
  await rm(path, { force: true });
  const database = new DatabaseSync(path);
  database.exec(schema);
  const metadata = database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  metadata.run("schemaVersion", "1");
  metadata.run("encoderModelId", encoderModelId);
  metadata.run("dimensions", String(dimensions));
  return database;
}

export function insertJurisdiction(database: DatabaseSync, jurisdiction: Jurisdiction): void {
  database
    .prepare("INSERT INTO jurisdictions (id, name, current_as_of) VALUES (?, ?, ?)")
    .run(jurisdiction.id, jurisdiction.name, jurisdiction.currentAsOf);
}

export function insertSource(
  database: DatabaseSync,
  source: Source & { jurisdiction: string; position: number },
  sections: Section[],
): void {
  database
    .prepare(
      "INSERT INTO sources (id, jurisdiction, title, version, url, sha256, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      source.id,
      source.jurisdiction,
      source.title,
      source.version,
      source.url,
      source.sha256,
      source.position,
    );
  const section = database.prepare(
    "INSERT INTO sections (source_id, jurisdiction, citation, heading, text) VALUES (?, ?, ?, ?, ?)",
  );
  const search = database.prepare(
    "INSERT INTO sections_fts (rowid, citation, heading, title, text) VALUES (?, ?, ?, ?, ?)",
  );
  for (const item of sections) {
    const { lastInsertRowid } = section.run(
      source.id,
      source.jurisdiction,
      item.citation,
      item.heading,
      item.text,
    );
    search.run(lastInsertRowid, item.citation, item.heading, source.title, item.text);
  }
}

export function finishLibrary(database: DatabaseSync): void {
  database.exec("INSERT INTO sections_fts (sections_fts) VALUES ('optimize')");
  database.exec("VACUUM");
  database.close();
}
