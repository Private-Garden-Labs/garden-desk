import { stat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { cisgSections } from "./cisg.js";
import { createLibrary, finishLibrary, insertJurisdiction, insertSource } from "./database.js";
import { euSections } from "./eu.js";
import { euTextSections } from "./eu-text.js";
import {
  type Amendment,
  lawsRoot,
  pinnedText,
  readLawSources,
  type Section,
  type Source,
} from "./sources.js";
import { amendmentNote, constitutionSections, ecfrSections, usCodeSections } from "./us.js";
import { writeVectors } from "./vectors.js";

const parsers: Record<Source["format"], (text: string, source: Source) => Section[]> = {
  uscode: usCodeSections,
  constitution: constitutionSections,
  ecfr: ecfrSections,
  eurlex: euSections,
  "eurlex-text": euTextSections,
  cisg: cisgSections,
};

async function amendmentNotes(amendments: Amendment[]): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  for (const amendment of amendments) {
    const note = amendmentNote(await pinnedText(amendment), amendment);
    const earlier = notes.get(amendment.section);
    notes.set(amendment.section, earlier === undefined ? note : `${earlier}\n\n${note}`);
  }
  return notes;
}

async function sourceSections(source: Source, notes: Map<string, string>): Promise<Section[]> {
  const sections = parsers[source.format](await pinnedText(source), source);
  if (sections.length === 0) throw new Error(`No sections found in ${source.id}.`);
  return sections.map((section) => {
    const note = notes.get(section.citation);
    if (note === undefined) return section;
    notes.delete(section.citation);
    return { ...section, text: `${section.text}\n\n${note}` };
  });
}

async function build(): Promise<void> {
  const { values } = parseArgs({
    options: {
      vectors: { type: "boolean", default: false },
      "llama-server": { type: "string" },
      encoder: { type: "string" },
    },
  });
  const server = values["llama-server"];
  if (values.vectors && (server === undefined || values.encoder === undefined)) {
    throw new Error("--vectors needs --llama-server <path> and --encoder <path to the GGUF file>.");
  }
  const library = await readLawSources();
  const notes = await amendmentNotes(library.amendments);
  const output = join(lawsRoot, "law-library.sqlite");
  const database = await createLibrary(output);
  database.exec("BEGIN");
  for (const jurisdiction of library.jurisdictions) {
    insertJurisdiction(database, jurisdiction);
    const sources = Object.values(jurisdiction.tiers).flat();
    for (const [position, source] of sources.entries()) {
      const sections = await sourceSections(source, notes);
      insertSource(database, { ...source, jurisdiction: jurisdiction.id, position }, sections);
      console.log(`${jurisdiction.id} ${source.id}: ${sections.length} sections`);
    }
  }
  database.exec("COMMIT");
  if (notes.size > 0)
    throw new Error(`Amended sections not found: ${[...notes.keys()].join(", ")}`);
  if (server !== undefined && values.encoder !== undefined && values.vectors) {
    await writeVectors(database, server, values.encoder);
  }
  finishLibrary(database);
  console.log(`${output}: ${(await stat(output)).size} bytes`);
}

await build();
