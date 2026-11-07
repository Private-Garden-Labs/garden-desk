import type { LawContext, LawSection } from "../laws/law-library.js";
import { object, objectSchema, type ToolSpec, textParam } from "./generic-tool-support.js";

function sectionText(section: LawSection, index: number): string {
  const heading = section.heading.length > 0 ? ` - ${section.heading}` : "";
  return `[${index + 1}] ${section.citation}${heading}\nSource: ${section.source}\n${section.text}`;
}

function lawsDescription(laws: LawContext): string {
  if (laws.id.startsWith("company:"))
    return `Search the ${laws.name} pack: the user's own company documents (policies, rules, handbook). Answer questions about company rules from it. Current as of: ${laws.currentAsOf}.`;
  return `Search the included ${laws.name} law by topic, clause text, or citation. Covers only the acts Garden Desk includes, current as of: ${laws.currentAsOf}.`;
}

export function lawsTool(laws: LawContext): ToolSpec {
  return {
    definition: {
      name: "laws",
      description: lawsDescription(laws),
      params: objectSchema({ query: { type: "string" } }, ["query"]),
    },
    parse: (value) => ({ query: textParam(object(value), "query", 4_096) }),
    execute: async (value, context) => {
      const sections = await laws.search((value as { query: string }).query, context.signal);
      if (sections.length === 0)
        return { content: `No included ${laws.name} law matched.`, failed: false };
      return { content: sections.map(sectionText).join("\n\n"), failed: false };
    },
  };
}
