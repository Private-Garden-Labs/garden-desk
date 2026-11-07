import type { Jurisdiction, LawCitations } from "@gardendesk/shared";

export interface LawTarget {
  jurisdiction: Jurisdiction;
  source: string;
  citation?: string;
}

export interface CitationIndex {
  pattern: RegExp | undefined;
  targets: Map<string, LawTarget>;
}

export type CitationPart = string | { text: string; target: LawTarget };

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export const EMPTY_CITATION_INDEX: CitationIndex = { pattern: undefined, targets: new Map() };

export function citationIndex(groups: LawCitations): CitationIndex {
  const targets = new Map<string, LawTarget>();
  const prefixes = new Set<string>();
  for (const { jurisdiction, source, citations } of groups) {
    for (const citation of citations) {
      if (!targets.has(citation)) targets.set(citation, { jurisdiction, source, citation });
      const prefix = citation.slice(0, citation.lastIndexOf(" ") + 1);
      if (prefix !== "") prefixes.add(prefix);
    }
  }
  if (prefixes.size === 0) return EMPTY_CITATION_INDEX;
  const alternatives = [...prefixes]
    .sort((left, right) => right.length - left.length)
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  return { pattern: new RegExp(`(${alternatives.join("|")})(\\S+)`, "gu"), targets };
}

function resolved(prefix: string, token: string, index: CitationIndex) {
  for (let end = token.length; end > 0; end -= 1) {
    const target = index.targets.get(prefix + token.slice(0, end));
    if (target !== undefined && !/[\p{L}\p{N}]/u.test(token[end] ?? "")) return { end, target };
  }
  return undefined;
}

export function citationParts(text: string, index: CitationIndex): CitationPart[] {
  if (index.pattern === undefined) return [text];
  const parts: CitationPart[] = [];
  let last = 0;
  for (const match of text.matchAll(index.pattern)) {
    const [, prefix = "", token = ""] = match;
    const found = resolved(prefix, token, index);
    if (found === undefined) continue;
    const end = match.index + prefix.length + found.end;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ text: text.slice(match.index, end), target: found.target });
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function linkChildren(node: HastNode, index: CitationIndex): void {
  if (node.tagName === "code" || node.tagName === "pre" || node.children === undefined) return;
  node.children = node.children.flatMap((child): HastNode[] => {
    if (child.type !== "text") {
      linkChildren(child, index);
      return [child];
    }
    return citationParts(child.value ?? "", index).map((part) =>
      typeof part === "string"
        ? { type: "text", value: part }
        : {
            type: "element",
            tagName: "cite",
            properties: { dataCitation: part.target.citation },
            children: [{ type: "text", value: part.text }],
          },
    );
  });
}

export function rehypeLawCitations(index: CitationIndex) {
  return () => (tree: HastNode) => linkChildren(tree, index);
}
