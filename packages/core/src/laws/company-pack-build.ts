import { createPrivateKey, generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { crc32, deflateRawSync } from "node:zlib";
import type { CompanyPackManifest } from "@gardendesk/shared";
import { digest } from "../runtime/models.js";
import type { Embed } from "./law-library.js";
import { chunkText } from "./law-search.js";

const SECTION_CHARACTERS = 2_000;
const TEXT_FILE = /\.(md|txt)$/iu;
const DOCUMENT_FILE = /\.(docx?|pdf)$/iu;
const SCHEMA = `
  CREATE TABLE jurisdictions (id TEXT PRIMARY KEY, name TEXT NOT NULL, current_as_of TEXT NOT NULL);
  CREATE TABLE sources (id TEXT PRIMARY KEY, jurisdiction TEXT NOT NULL, title TEXT NOT NULL, version TEXT NOT NULL, url TEXT NOT NULL, sha256 TEXT NOT NULL, position INTEGER NOT NULL);
  CREATE TABLE sections (id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, jurisdiction TEXT NOT NULL, citation TEXT NOT NULL, heading TEXT NOT NULL, text TEXT NOT NULL);
  CREATE VIRTUAL TABLE sections_fts USING fts5(citation, heading, title, text, content='');
  CREATE TABLE chunks (section_id INTEGER NOT NULL, vector BLOB NOT NULL);
`;

export type ExtractDocuments = (
  folder: string,
  guestPaths: string[],
) => Promise<Array<string | undefined>>;

export interface CompanyPackRequest {
  source: string;
  name: string;
  id: string;
  publisher: string;
  output: string;
}

export interface PublisherKey {
  publicKey: string;
  privateKey: KeyObject;
}

interface PackDocument {
  title: string;
  text: string;
  sha256: string;
}

function packSections(text: string): Array<{ heading: string; text: string }> {
  const sections: Array<{ heading: string; text: string }> = [];
  for (const block of text.split(/\n+/u).map((part) => part.trim())) {
    if (block === "") continue;
    const heading = /^#{1,6}[ \t]+(.*)/u.exec(block)?.[1]?.trim();
    const last = sections.at(-1);
    const fits = last !== undefined && last.text.length + block.length < SECTION_CHARACTERS;
    if (heading === undefined && fits) last.text = `${last.text}\n\n${block}`;
    else sections.push({ heading: heading ?? "", text: block });
  }
  return sections;
}

export async function publisherKey(path: string): Promise<PublisherKey> {
  const saved = await readFile(path, "utf8").catch(() => undefined);
  if (saved !== undefined) {
    const stored = JSON.parse(saved) as { publicKey: string; privateKey: string };
    const der = Buffer.from(stored.privateKey, "base64");
    return {
      publicKey: stored.publicKey,
      privateKey: createPrivateKey({ key: der, format: "der", type: "pkcs8" }),
    };
  }
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKey = pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  await writeFile(path, JSON.stringify({ publicKey, privateKey }), { mode: 0o600, flag: "wx" });
  return { publicKey, privateKey: pair.privateKey };
}

async function readDocuments(source: string, extract: ExtractDocuments) {
  const entries = await readdir(source, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(source, join(entry.parentPath, entry.name)))
    .filter((file) => !file.split(sep).some((part) => part.startsWith(".")))
    .sort();
  const guestPaths = files
    .filter((file) => DOCUMENT_FILE.test(file))
    .map((file) => `/source/${file.split(sep).join("/")}`);
  const extracted = guestPaths.length === 0 ? [] : await extract(source, guestPaths);
  const documents: PackDocument[] = [];
  let skipped = 0;
  const textOf = async (file: string, path: string) => {
    if (TEXT_FILE.test(file)) return await readFile(path, "utf8");
    return DOCUMENT_FILE.test(file) ? extracted.shift() : undefined;
  };
  for (const file of files) {
    const path = join(source, file);
    const text = await textOf(file, path);
    if (text === undefined || text.trim() === "") skipped += 1;
    else documents.push({ title: basename(file, extname(file)), text, sha256: await digest(path) });
  }
  return { documents, skipped };
}

async function writeDatabase(
  path: string,
  request: CompanyPackRequest & { currentAsOf: string },
  documents: PackDocument[],
  embed: Embed,
): Promise<number> {
  const database = new DatabaseSync(path);
  const jurisdiction = `company:${request.id}`;
  try {
    database.exec(`${SCHEMA} BEGIN;`);
    database
      .prepare("INSERT INTO jurisdictions VALUES (?, ?, ?)")
      .run(jurisdiction, request.name, request.currentAsOf);
    const source = database.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, '', ?, ?)");
    const section = database.prepare(
      "INSERT INTO sections (source_id, jurisdiction, citation, heading, text) VALUES (?, ?, ?, ?, ?)",
    );
    const keywords = database.prepare(
      "INSERT INTO sections_fts (rowid, citation, heading, title, text) VALUES (?, ?, ?, ?, ?)",
    );
    const chunk = database.prepare("INSERT INTO chunks VALUES (?, ?)");
    let count = 0;
    for (const [position, document] of documents.entries()) {
      const sourceId = `${request.id}-${position + 1}`;
      source.run(
        sourceId,
        jurisdiction,
        document.title,
        request.currentAsOf,
        document.sha256,
        position,
      );
      for (const [index, part] of packSections(document.text).entries()) {
        const citation = `${document.title} §${index + 1}`;
        const row = section.run(sourceId, jurisdiction, citation, part.heading, part.text);
        keywords.run(row.lastInsertRowid, citation, part.heading, document.title, part.text);
        for (const text of chunkText(part.text))
          chunk.run(
            row.lastInsertRowid,
            new Uint8Array(Float32Array.from(await embed(text)).buffer),
          );
        count += 1;
      }
    }
    database.exec("COMMIT;");
    return count;
  } finally {
    database.close();
  }
}

export function zip(files: Array<[string, Buffer]>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const fileName = Buffer.from(name);
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    local.copy(entry, 16, 14, 26);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, fileName, compressed);
    central.push(entry, fileName);
    offset += local.length + fileName.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

export async function buildCompanyPack(
  request: CompanyPackRequest,
  key: PublisherKey,
  services: { embed: Embed; extract: ExtractDocuments },
): Promise<{ path: string; sections: number; skipped: number }> {
  const { documents, skipped } = await readDocuments(request.source, services.extract);
  const directory = await mkdtemp(join(tmpdir(), "garden-desk-pack-"));
  try {
    const currentAsOf = new Date().toISOString().slice(0, 10);
    const database = join(directory, "pack.sqlite");
    const built = { ...request, currentAsOf };
    const sections = await writeDatabase(database, built, documents, services.embed);
    if (sections === 0) throw new Error("company_pack_empty");
    const bytes = await readFile(database);
    const manifest: CompanyPackManifest = {
      id: request.id,
      jurisdiction: `company:${request.id}`,
      name: request.name,
      currentAsOf,
      access: "free",
      file: `${request.id}.gdpack`,
      bytes: bytes.length,
      sha256: await digest(database),
      publisher: request.publisher,
      kind: "company",
      publicKey: key.publicKey,
    };
    const signed = Buffer.from(JSON.stringify(manifest));
    const path = join(request.output, manifest.file);
    const signature = sign(null, signed, key.privateKey);
    await writeFile(
      path,
      zip([
        ["pack.sqlite", bytes],
        ["manifest.json", signed],
        ["manifest.sig", signature],
      ]),
    );
    return { path, sections, skipped };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
