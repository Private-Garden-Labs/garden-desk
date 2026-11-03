import type { Dirent } from "node:fs";
import { opendir } from "node:fs/promises";
import { join } from "node:path";

async function visibleEntries(directory: string): Promise<Dirent[]> {
  const entries: Dirent[] = [];
  for await (const entry of await opendir(directory)) {
    if (!entry.name.startsWith(".")) entries.push(entry);
  }
  return entries;
}

export async function sampleFolderFileNames(root: string, limit: number): Promise<string[]> {
  const names: string[] = [];
  const queue = [root];
  for (let next = queue.shift(); next !== undefined && names.length < limit; next = queue.shift()) {
    for (const entry of await visibleEntries(next)) {
      if (entry.isFile()) names.push(entry.name);
      if (entry.isDirectory()) queue.push(join(next, entry.name));
    }
  }
  return names.slice(0, limit);
}
