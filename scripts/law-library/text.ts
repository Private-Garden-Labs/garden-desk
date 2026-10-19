const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  sect: "§",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return namedEntities[name] ?? entity;
  });
}

/** One trimmed line per paragraph, with a bare list label joined to the line it labels. */
export function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t    ]+/gu, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/^(\(?[0-9A-Za-z]{1,5}[.)]|[—–•-])\n/gmu, "$1 ");
}

export function markupToText(markup: string): string {
  const text = markup
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/giu, "")
    .replace(/\s+/gu, " ")
    .replace(/<\/t[dh]>/giu, " ")
    .replace(/<br\b[^>]*>|<\/(?:p|div|tr|li|table|h\d|hd\d|hed|fp|extract)>/giu, "\n")
    .replace(/<[^>]+>/gu, "");
  return tidy(decodeEntities(text));
}

export function cite(prefix: string, label: string): string {
  return `${prefix}${/\s/u.test(prefix) ? ", " : " "}${label}`;
}
