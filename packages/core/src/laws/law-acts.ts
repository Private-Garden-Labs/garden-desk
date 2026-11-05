import type { DatabaseSync } from "node:sqlite";
import type { Jurisdiction, LawAct, LawCitations } from "@gardendesk/shared";

export function readAct(database: DatabaseSync, source: string): LawAct | undefined {
  const act = database
    .prepare("SELECT id, title, version, url FROM sources WHERE id = ?")
    .get(source) as Omit<LawAct, "sections"> | undefined;
  if (act === undefined) return undefined;
  const sections = database
    .prepare("SELECT citation, heading, text FROM sections WHERE source_id = ? ORDER BY id")
    .all(source) as LawAct["sections"];
  return { ...act, sections };
}

export function actCitations(database: DatabaseSync, jurisdiction: Jurisdiction): LawCitations {
  const rows = database
    .prepare(
      `SELECT source_id AS source, json_group_array(citation) AS citations
       FROM (SELECT source_id, citation FROM sections WHERE jurisdiction = ? ORDER BY id)
       GROUP BY source_id`,
    )
    .all(jurisdiction) as Array<{ source: string; citations: string }>;
  return rows.map((row) => ({
    jurisdiction,
    source: row.source,
    citations: JSON.parse(row.citations) as string[],
  }));
}
