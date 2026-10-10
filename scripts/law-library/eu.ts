import type { Section, Source } from "./sources.js";
import { cite, markupToText } from "./text.js";

type MarkerKind = "article" | "subtitle" | "document" | "division" | "end";

const markerKinds: Record<string, MarkerKind> = {
  "ti-art": "article",
  "oj-ti-art": "article",
  "title-article-norm": "article",
  "sti-art": "subtitle",
  "oj-sti-art": "subtitle",
  "stitle-article-norm": "subtitle",
  "eli-title": "subtitle",
  "doc-ti": "document",
  "oj-doc-ti": "document",
  "title-annex-1": "document",
  "title-annex-2": "document",
  "ti-section-1": "division",
  "ti-section-2": "division",
  "oj-ti-section-1": "division",
  "oj-ti-section-2": "division",
  "title-division-1": "division",
  "title-division-2": "division",
  final: "end",
  "oj-final": "end",
};

const markerPattern =
  /<p\b[^>]*\bclass="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/p>|<div class="((?:oj-)?final)">|<div class="(eli-title)"[^>]*>([\s\S]*?)<\/div>/gu;

interface Marker {
  kind: MarkerKind;
  label: string;
  body: string;
}

interface Builder {
  base: string;
  documentPrefix: string;
  prefix: string;
  defaultHeading: string;
  awaitingTitle: boolean;
  current: (Section & { annex: boolean }) | undefined;
  sections: Section[];
}

function cleanMarkup(html: string): string {
  return html
    .replace(/<p class="(?:modref|arrow|note|oj-note|footnote)">[\s\S]*?<\/p>/gu, "")
    .replace(/\(\s*<a\b[^>]*>\s*<span class="[^"]*super[^"]*">[^<]*<\/span>\s*<\/a>\s*\)/gu, "")
    .replace(/<a\b[^>]*>\(<span class="[^"]*super[^"]*">[^<]*<\/span>\)<\/a>/gu, "");
}

function markers(html: string): Marker[] {
  const found = [...html.matchAll(markerPattern)].flatMap((match) => {
    const kind = markerKinds[match[1] ?? match[3] ?? match[4] ?? ""];
    return kind === undefined ? [] : [{ match, kind }];
  });
  return found.map(({ match, kind }, index) => ({
    kind,
    label: markupToText(match[2] ?? match[5] ?? "").replace(/\n/gu, " "),
    body: html.slice(match.index + match[0].length, found[index + 1]?.match.index ?? html.length),
  }));
}

function close(builder: Builder): void {
  const section = builder.current;
  builder.current = undefined;
  if (section === undefined) return;
  const text = markupToText(section.text);
  if (text !== "")
    builder.sections.push({ citation: section.citation, heading: section.heading, text });
}

function open(builder: Builder, citation: string, annex: boolean): void {
  close(builder);
  builder.current = { citation, heading: annex ? "" : builder.defaultHeading, text: "", annex };
}

function startDocument(builder: Builder, prefix: string): void {
  close(builder);
  builder.documentPrefix = prefix;
  builder.prefix = prefix;
}

function onDocumentTitle(builder: Builder, marker: Marker): void {
  const protocol = /^PROTOCOL \(No (\d+)\)$/iu.exec(marker.label);
  const annex = /^ANNEX(?:\s+([IVXLC]+[A-Z]?|\d+[a-z]?|[A-Z])\b)?/u.exec(marker.label);
  if (protocol !== null) {
    startDocument(builder, `Protocol (No ${protocol[1]})`);
    builder.defaultHeading = "";
    open(builder, builder.prefix, true);
    builder.awaitingTitle = true;
  } else if (/^(?:ANNEXES|PROTOCOLS)\b/u.test(marker.label)) {
    startDocument(builder, builder.base);
  } else if (annex !== null) {
    builder.prefix = cite(
      builder.documentPrefix,
      annex[1] === undefined ? "Annex" : `Annex ${annex[1]}`,
    );
    open(builder, builder.prefix, true);
    builder.awaitingTitle = true;
  } else if (builder.awaitingTitle && builder.current?.heading === "") {
    builder.current.heading = marker.label;
    builder.defaultHeading = marker.label;
    builder.awaitingTitle = false;
  } else if (builder.current !== undefined) {
    builder.current.text += `<p>${marker.label}</p>`;
  }
}

function onMarker(builder: Builder, marker: Marker): void {
  if (marker.kind === "article") {
    open(builder, cite(builder.prefix, marker.label), false);
  } else if (
    marker.kind === "subtitle" &&
    builder.current &&
    markupToText(builder.current.text) === ""
  ) {
    builder.current.heading = marker.label;
  } else if (marker.kind === "document") {
    onDocumentTitle(builder, marker);
  } else if (marker.kind === "end" || (marker.kind === "division" && !builder.current?.annex)) {
    close(builder);
    return;
  } else if (builder.current !== undefined) {
    builder.current.text += `<p>${marker.label}</p>`;
  }
  if (builder.current !== undefined) builder.current.text += marker.body;
}

/**
 * EUR-Lex XHTML (Official Journal and consolidated layouts): articles and annexes become sections,
 * recitals and signatures are left out. Protocols annexed to the Treaties get their own prefix.
 */
export function euSections(html: string, source: Source): Section[] {
  const builder: Builder = {
    base: source.citation,
    documentPrefix: source.citation,
    prefix: source.citation,
    defaultHeading: "",
    awaitingTitle: false,
    current: undefined,
    sections: [],
  };
  for (const marker of markers(cleanMarkup(html))) {
    if (marker.kind === "document" && marker.label === source.until) break;
    onMarker(builder, marker);
  }
  close(builder);
  return builder.sections;
}
