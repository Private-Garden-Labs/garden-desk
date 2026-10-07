import type { Amendment, Section, Source } from "./sources.js";
import { decodeEntities, markupToText, tidy } from "./text.js";

function usCodeField(document: string, name: string): string {
  const pattern = new RegExp(
    `<!-- field-start:${name} -->([\\s\\S]*?)<!-- field-end:${name} -->`,
    "u",
  );
  return markupToText(pattern.exec(document)?.[1] ?? "");
}

/** GovInfo U.S. Code HTML: one document per section, selected by item path prefix. */
export function usCodeSections(html: string, source: Source): Section[] {
  const sections: Section[] = [];
  for (const document of html.split("<!-- documentid:").slice(1)) {
    const path = /<!-- itempath:\/[^/]+\/(.*?) -->/u.exec(document)?.[1] ?? "";
    const number = /(?:^|\/)Sec\. (\S+)$/u.exec(path)?.[1];
    if (number === undefined || !(source.paths ?? []).some((prefix) => path.startsWith(prefix))) {
      continue;
    }
    const text = usCodeField(document, "statute");
    if (text === "") continue;
    const heading = usCodeField(document, "head").replace(/^§\s*\S+?\.\s*/u, "");
    sections.push({ citation: `${source.citation} ${number}`, heading, text });
  }
  return sections;
}

function constitutionArticles(part: string, prefix: string): Section[] {
  const pieces = part.split(/^ +Article \[?([IVXL]+)\.\]? *$/mu);
  const sections: Section[] = [];
  for (let index = 1; index < pieces.length; index += 2) {
    const body = (pieces[index + 1] ?? "").split(/^ +Proposal and Ratification *$/mu)[0] ?? "";
    const text = tidy(body.replace(/\n(?=\S)/gu, " "));
    sections.push({ citation: `${prefix} ${pieces[index]}`, heading: "", text });
  }
  return sections;
}

/** GovInfo House Document 110-50: the Constitution as plain text, with footnote blocks between rules. */
export function constitutionSections(html: string): Section[] {
  const plain = decodeEntities(html.replace(/<[^>]+>/gu, ""));
  const text = plain
    .slice(plain.indexOf("We the People"), plain.indexOf("PROPOSED AMENDMENTS TO THE CONSTITUTION"))
    .replace(/\n-{20,}\n[\s\S]*?\n-{20,}\n/gu, "\n")
    .replace(/\\[0-9a-z]+\\/giu, "");
  const amendments = text.indexOf("ARTICLES IN ADDITION TO");
  const original = text.slice(0, text.search(/^\s*done in Convention/mu));
  const preamble = original.slice(0, original.search(/^ +Article I\. *$/mu));
  return [
    {
      citation: "U.S. Const. pmbl.",
      heading: "Preamble",
      text: tidy(preamble.replace(/\s+/gu, " ")),
    },
    ...constitutionArticles(original, "U.S. Const. art."),
    ...constitutionArticles(text.slice(amendments), "U.S. Const. amend."),
  ];
}

/** eCFR versioner XML for one part: one DIV8 element per section. */
export function ecfrSections(xml: string, source: Source): Section[] {
  const sections: Section[] = [];
  for (const match of xml.matchAll(/<DIV8 N="([^"]+)"[^>]*>([\s\S]*?)<\/DIV8>/gu)) {
    const body = match[2] ?? "";
    const head = /<HEAD>([\s\S]*?)<\/HEAD>/u.exec(body);
    const heading = markupToText(head?.[1] ?? "").replace(/^§\s*\S+\s*/u, "");
    const text = markupToText(
      body.replace(head?.[0] ?? "", "").replace(/<CITA\b[\s\S]*?<\/CITA>/gu, ""),
    );
    if (text !== "") sections.push({ citation: `${source.citation} ${match[1]}`, heading, text });
  }
  return sections;
}

function closingTag(xml: string, start: number, name: string): number {
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, "gu");
  tags.lastIndex = start;
  let depth = 0;
  for (const tag of xml.matchAll(tags)) {
    depth += tag[1] === "/" ? -1 : 1;
    if (depth === 0) return tag.index + tag[0].length;
  }
  throw new Error(`Unclosed <${name}> element.`);
}

/** The amending provision of a public law (USLM XML), as a plain note for the amended section. */
export function amendmentNote(xml: string, amendment: Amendment): string {
  const start = xml.indexOf(`identifier="${amendment.provision}"`);
  const open = xml.lastIndexOf("<", start);
  const name = /^<([a-zA-Z]+)/u.exec(xml.slice(open))?.[1];
  if (start < 0 || name === undefined) {
    throw new Error(`Provision ${amendment.provision} is missing from ${amendment.url}.`);
  }
  const provision = xml
    .slice(open, closingTag(xml, open, name))
    .replace(/<(sidenote|page)\b[\s\S]*?<\/\1>\s*/gu, " ");
  const text = markupToText(provision.replace(/<\/(?:heading|chapeau|content)>/gu, "</p>")).replace(
    /\n(?=[.;,]$)/gmu,
    "",
  );
  return `Later amendment: ${amendment.law} (${amendment.date}) amended this section:\n${text}`;
}
