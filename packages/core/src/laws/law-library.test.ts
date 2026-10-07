import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { LawLibrary } from "./law-library.js";

async function library(): Promise<LawLibrary> {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-laws-"));
  const path = join(root, "law-library.sqlite");
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE jurisdictions (id TEXT PRIMARY KEY, name TEXT NOT NULL, current_as_of TEXT NOT NULL);
    CREATE TABLE sources (id TEXT PRIMARY KEY, jurisdiction TEXT NOT NULL, title TEXT NOT NULL, version TEXT NOT NULL, url TEXT NOT NULL, sha256 TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE sections (id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, jurisdiction TEXT NOT NULL, citation TEXT NOT NULL, heading TEXT NOT NULL, text TEXT NOT NULL);
    CREATE VIRTUAL TABLE sections_fts USING fts5(citation, heading, title, text, content='');
    CREATE TABLE chunks (section_id INTEGER NOT NULL, vector BLOB NOT NULL);
    INSERT INTO jurisdictions VALUES ('us', 'United States (federal)', '2026'), ('eu', 'European Union', '2026');
    INSERT INTO sources VALUES ('sherman', 'us', 'Sherman Act', '2024', '', '', 0), ('vber', 'eu', 'VBER', '2022', '', '', 0);
    INSERT INTO sections VALUES (1, 'sherman', 'us', '15 U.S.C. 1', '', 'Every contract fixing resale price is illegal.'),
      (2, 'vber', 'eu', 'Regulation (EU) 2022/720, Article 4', '', 'Fixing a minimum resale price is a hardcore restriction.');
    INSERT INTO sections_fts (rowid, citation, heading, title, text) SELECT id, citation, heading, '', text FROM sections;
  `);
  database.prepare("INSERT INTO chunks VALUES (?, ?), (?, ?)").run(1, unit(), 2, unit());
  database.close();
  return new LawLibrary(path, join(root, "settings.json"), async () => [1, 0]);
}

function unit(): Uint8Array {
  return new Uint8Array(Float32Array.from([1, 0]).buffer);
}

describe("law library", () => {
  it("searches only the selected jurisdiction and refuses a disabled one", async () => {
    const laws = await library();
    const sections = await laws.context("eu").search("minimum resale price");
    expect(sections.map((section) => section.citation)).toEqual([
      "Regulation (EU) 2022/720, Article 4",
    ]);
    laws.setEnabled("us", false);
    expect(() => laws.context("us")).toThrow("law_jurisdiction_unavailable");
    laws.close();
  });
});
