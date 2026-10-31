import { copyFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

export async function copyLawLibrary(source: string, destination: string): Promise<void> {
  await copyFile(source, destination);
  const database = new DatabaseSync(destination, { readOnly: true, allowExtension: false });
  try {
    const result = database
      .prepare(`
      SELECT EXISTS(SELECT 1 FROM chunks) AND NOT EXISTS(
        SELECT 1 FROM sections WHERE NOT EXISTS(
          SELECT 1 FROM chunks WHERE chunks.section_id = sections.id
        )
      ) AS complete
    `)
      .get();
    if (result?.complete !== 1)
      throw new Error("Law library has missing vectors. Build it with pnpm laws:build --vectors.");
  } finally {
    database.close();
  }
}
