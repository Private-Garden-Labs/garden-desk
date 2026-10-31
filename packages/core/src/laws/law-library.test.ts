import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { INFERENCE_PROFILE, LAW_PACK_DIRECTORIES } from "@gardendesk/shared";
import { describe, expect, it } from "vitest";
import { type Embed, LawLibrary } from "./law-library.js";
import { chunkText, sectionExcerpt } from "./law-search.js";

async function library(
  embed: Embed = async () => [1, 0],
  seed?: (database: DatabaseSync) => void,
): Promise<LawLibrary> {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-laws-"));
  for (const [id, directory] of Object.entries(LAW_PACK_DIRECTORIES)) {
    await mkdir(join(root, directory));
    const database = new DatabaseSync(join(root, directory, "law-library.sqlite"));
    seedLibrary(database, seed);
    database
      .prepare(
        "DELETE FROM chunks WHERE section_id IN (SELECT id FROM sections WHERE jurisdiction <> ?)",
      )
      .run(id);
    database.prepare("DELETE FROM sections WHERE jurisdiction <> ?").run(id);
    database.prepare("DELETE FROM sources WHERE jurisdiction <> ?").run(id);
    database.prepare("DELETE FROM jurisdictions WHERE id <> ?").run(id);
    database.exec(
      "INSERT INTO sections_fts (rowid, citation, heading, title, text) SELECT id, citation, heading, '', text FROM sections;",
    );
    database.close();
  }
  return new LawLibrary(root, join(root, "settings.json"), embed);
}

function seedLibrary(database: DatabaseSync, seed?: (database: DatabaseSync) => void): void {
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
  `);
  database.prepare("INSERT INTO chunks VALUES (?, ?), (?, ?)").run(1, unit(), 2, unit());
  seed?.(database);
}

function unit(): Uint8Array {
  return new Uint8Array(Float32Array.from([1, 0]).buffer);
}

it("keeps the opening rule beside a matched exception within the excerpt budget", () => {
  const rule = "A covered employee must receive overtime pay after forty hours.";
  const exception = "A narrow exception applies to this specific group.";
  const filler = "Other conditions apply. ".repeat(100);
  const text = [rule, filler, filler, exception].join("\n");
  const excerpt = sectionExcerpt(text, chunkText(text).length - 1, 2_000);
  expect(excerpt).toContain(rule);
  expect(excerpt).toContain(exception);
  expect(excerpt.length).toBeLessThanOrEqual(2_000);
});

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

  it("keeps a digit-only query within the encoder context", async () => {
    const embedded: string[] = [];
    const laws = await library(async (text) => {
      embedded.push(text);
      return [1, 0];
    });
    await laws.context("eu").search("1".repeat(5_000));
    const digits = embedded[0]?.split("Query: ")[1]?.length ?? 0;
    expect(digits + 24).toBeLessThanOrEqual(INFERENCE_PROFILE.encoderContextTokens);
    laws.close();
  });

  it("shows the part of a long section that matched", async () => {
    const filler = "Other rules apply here. ".repeat(60);
    const other = new Uint8Array(Float32Array.from([0, 1]).buffer);
    const laws = await library(undefined, (database) => {
      database
        .prepare("INSERT INTO sections VALUES (3, 'sherman', 'us', '15 U.S.C. 45', '', ?)")
        .run(`${filler}\n${filler}\n${filler}\nOnline sales may not be banned.`);
      database
        .prepare("INSERT INTO chunks VALUES (?, ?), (?, ?), (?, ?)")
        .run(3, other, 3, other, 3, unit());
    });
    const sections = await laws.context("us").search("online sales");
    const long = sections.find((section) => section.citation === "15 U.S.C. 45");
    expect(long?.text).toContain("Online sales may not be banned.");
    laws.close();
  });
});
