import type { Section, Source } from "./sources.js";
import { cite, markupToText } from "./text.js";

interface Start {
  label: string;
  heading: string;
  annex: boolean;
}

interface State {
  sections: Section[];
  current: Section | undefined;
  inAnnex: boolean;
  awaitingHeading: boolean;
}

function sectionStart(line: string): Start | undefined {
  const clause = /^Clause (\d+): (.+)$/u.exec(line);
  const namedClause = /^(.+) \(clause (\d+)\)$/u.exec(line);
  const annex = /^ANNEX(?: ([IVX]+))?$/u.exec(line);
  if (/^Article \d+[a-z]*$/u.test(line)) return { label: line, heading: "", annex: false };
  if (clause !== null) {
    return { label: `Clause ${clause[1]}`, heading: clause[2] ?? "", annex: false };
  }
  if (namedClause !== null) {
    return { label: `Clause ${namedClause[2]}`, heading: namedClause[1] ?? "", annex: false };
  }
  if (annex === null) return undefined;
  return {
    label: annex[1] === undefined ? "Annex" : `Annex ${annex[1]}`,
    heading: "",
    annex: true,
  };
}

function closesSection(line: string, inAnnex: boolean): boolean {
  return (
    /^Done at /u.test(line) || (!inAnnex && /^(?:CHAPTER|SECTION|TITLE) [IVX\d]+$/u.test(line))
  );
}

function close(state: State): void {
  if (state.current !== undefined && state.current.text !== "") state.sections.push(state.current);
  state.current = undefined;
}

function addText(state: State, line: string): void {
  const current = state.current;
  if (current === undefined || /^>[A-Z]+/u.test(line)) return;
  if (state.awaitingHeading && current.text === "" && line.length < 120 && !/[.;:,]$/u.test(line)) {
    current.heading = line;
  } else {
    current.text = current.text === "" ? line : `${current.text}\n${line}`;
  }
  state.awaitingHeading = false;
}

/** Older EUR-Lex HTML without class markers: article, clause and annex headings are found line by line. */
export function euTextSections(html: string, source: Source): Section[] {
  const state: State = { sections: [], current: undefined, inAnnex: false, awaitingHeading: false };
  for (const line of markupToText(html.replace(/[►◄][A-Z]*\d*/gu, "")).split("\n")) {
    const start = sectionStart(line);
    if (start === undefined && !closesSection(line, state.inAnnex)) {
      addText(state, line);
      continue;
    }
    close(state);
    if (start === undefined) continue;
    state.inAnnex ||= start.annex;
    state.current = {
      citation: cite(source.citation, start.label),
      heading: start.heading,
      text: "",
    };
    state.awaitingHeading = start.heading === "";
  }
  close(state);
  return state.sections;
}
