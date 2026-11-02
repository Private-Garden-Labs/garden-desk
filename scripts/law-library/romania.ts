import type { Section, Source } from "./sources.js";
import { cite, markupToText } from "./text.js";

const MARK = "";
const LEVELS = ["PRT", "CRT", "TTL", "CAP", "SEC", "PRG"];
const CEDILLA: Record<string, string> = { ş: "ș", Ş: "Ș", ţ: "ț", Ţ: "Ț" };

interface State {
  sections: Section[];
  cited: Set<string>;
  current: Section | undefined;
  path: string[];
  annex: string;
  inAnnex: boolean;
  awaitingHeading: boolean;
}

/** One line per paragraph, and a marked line for each part, title, chapter, section, article and annex heading. */
function markedLines(html: string): string[] {
  const marked = html
    .replace(/<span[^>]*class="S_[A-Z]+_SHORT"[^>]*>[^<]*<\/span>/gu, "")
    .replace(/<span[^>]*class="S_([A-Z]+)_TTL"[^>]*>/gu, `<br/>${MARK}$1 `)
    .replace(/<span[^>]*class="S_[A-Z]+_DEN"[^>]*>/gu, MARK)
    .replace(/<span[^>]*class="S_(?:ALN|LIT|PCT|LIN|PAR|NTA_PAR|SMN)"/gu, "<br/>$&");
  return markupToText(marked)
    .normalize("NFC")
    .replace(/[şŞţŢ]/gu, (letter) => CEDILLA[letter] ?? letter)
    .split("\n");
}

function close(state: State): void {
  const current = state.current;
  state.current = undefined;
  if (current === undefined || /^Abrogat(?:ă)?\.?$/u.test(current.text)) return;
  current.heading = [...state.path, current.heading].filter(Boolean).join(" › ");
  state.cited.add(current.citation);
  state.sections.push(current);
}

function addText(state: State, line: string): void {
  const current = state.current;
  if (current === undefined || /^\(la \d{2}-\d{2}-\d{4}, .*\)$/u.test(line)) return;
  if (state.awaitingHeading && line.length < 120 && !/[.;:,]$|^\(/u.test(line)) {
    current.heading = line;
  } else {
    const text = line === "Notă" ? "Notă:" : line;
    current.text = current.text === "" ? text : `${current.text}\n${text}`;
  }
  state.awaitingHeading = false;
}

function open(state: State, source: Source, label: string): void {
  close(state);
  state.current = { citation: cite(source.citation, label), heading: "", text: "" };
  state.awaitingHeading = true;
}

function startLevel(state: State, level: number, name: string): void {
  close(state);
  state.path = state.path.slice(0, level);
  state.path[level] = name.replace(/\*+\)/gu, "").trim();
  state.inAnnex = false;
}

function startAnnex(state: State, source: Source, label: string): void {
  const annex = label.trim().replace(/^Anexa/u, "anexa");
  const repeated = state.cited.has(cite(source.citation, annex));
  state.annex = repeated ? `${annex} (${state.path.filter(Boolean)[0]})` : annex;
  state.inAnnex = true;
  open(state, source, state.annex);
}

function startArticle(state: State, source: Source, label: string): void {
  const number = label.trim().replace(/^Articolul /u, "art. ");
  const repeated = state.cited.has(cite(source.citation, number));
  open(state, source, state.inAnnex || repeated ? `${state.annex}, ${number}` : number);
}

const HEADING = new RegExp(`^${MARK}([A-Z]+) ([^${MARK}]*)(?:${MARK}(.*))?$`, "u");

function readLine(state: State, source: Source, line: string): void {
  const [, kind = "", label = "", name = ""] = HEADING.exec(line) ?? [];
  const level = LEVELS.indexOf(kind);
  if (level >= 0) startLevel(state, level, name);
  else if (kind === "ANX") startAnnex(state, source, label);
  else if (kind === "ART") startArticle(state, source, label);
  else addText(state, kind === "" ? line : `${label}${name}`.trim());
}

/** Portal Legislativ printable form: one section per article or annex, headed by its title, chapter and section names. */
export function romanianSections(html: string, source: Source): Section[] {
  const state: State = {
    sections: [],
    cited: new Set(),
    current: undefined,
    path: [],
    annex: "",
    inAnnex: false,
    awaitingHeading: false,
  };
  const body = html.slice(html.indexOf('<span id="fisaact">'));
  for (const line of markedLines(body)) readLine(state, source, line);
  close(state);
  return state.sections;
}

/**
 * The printable form of the pinned consolidated version. Its address changes on every page view, so the
 * pin is the document page; a newer consolidation moves the pinned one to a link in the version history.
 */
export async function printableForm(
  url: string,
  version: string,
  download: (url: string) => Promise<Buffer>,
): Promise<Buffer> {
  const origin = new URL(url).origin;
  let page = (await download(url)).toString("utf8");
  const pinned = new RegExp(
    `title='${version.replaceAll(".", "\\.")}'[^>]*href='~/(?:\\.\\./)*(Public/DetaliiDocument/\\d+)'`,
    "u",
  ).exec(page);
  if (pinned !== null) page = (await download(`${origin}/${pinned[1]}`)).toString("utf8");
  const printable = /\/Public\/FormaPrintabila\/[A-Z0-9]+/u.exec(page)?.[0];
  if (printable === undefined) throw new Error(`No printable form on ${url}.`);
  return download(`${origin}${printable}`);
}
