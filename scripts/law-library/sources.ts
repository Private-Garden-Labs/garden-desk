import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface Pin {
  url: string;
  sha256: string;
}

export interface Source extends Pin {
  id: string;
  title: string;
  version: string;
  format: "uscode" | "constitution" | "ecfr" | "eurlex" | "eurlex-text" | "cisg";
  citation: string;
  paths?: string[];
  until?: string;
}

export interface Amendment extends Pin {
  section: string;
  law: string;
  date: string;
  provision: string;
}

export interface Jurisdiction {
  id: "us" | "eu";
  name: string;
  currentAsOf: string;
  tiers: Record<string, Source[]>;
}

export interface LawSources {
  jurisdictions: Jurisdiction[];
  amendments: Amendment[];
  /** Common names added to a section's heading, so both searches find it by those names. */
  aliases: Record<string, string>;
}

export interface Section {
  citation: string;
  heading: string;
  text: string;
}

export const lawsRoot = resolve(import.meta.dirname, "../../laws");
const cacheRoot = join(lawsRoot, ".cache");

export async function readLawSources(): Promise<LawSources> {
  return JSON.parse(await readFile(join(lawsRoot, "sources.json"), "utf8")) as LawSources;
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

async function cached(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { "user-agent": "garden-desk-law-library" } });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Returns the pinned file's text, downloading it into laws/.cache when missing. */
export async function pinnedText(pin: Pin): Promise<string> {
  const path = join(cacheRoot, pin.sha256);
  const stored = await cached(path);
  const data = stored ?? (await download(pin.url));
  const actual = sha256(data);
  if (actual !== pin.sha256) {
    throw new Error(`SHA-256 mismatch for ${pin.url}: pinned ${pin.sha256}, found ${actual}.`);
  }
  if (stored === undefined) {
    await mkdir(cacheRoot, { recursive: true });
    await writeFile(path, data);
  }
  return data.toString("utf8").replace(/^﻿/u, "");
}
