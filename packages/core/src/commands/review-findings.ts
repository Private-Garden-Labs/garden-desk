export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    labels: {
      type: "object",
      properties: {
        summary: { type: "string" },
        where: { type: "string" },
        mistake: { type: "string" },
        fix: { type: "string" },
        checked: { type: "string" },
      },
      required: ["summary", "where", "mistake", "fix", "checked"],
      additionalProperties: false,
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          where: { type: "string" },
          issue: { type: "string" },
          fix: { type: "string" },
          citations: { type: "array", items: { type: "string" } },
        },
        required: ["where", "issue", "fix", "citations"],
        additionalProperties: false,
      },
    },
    checked: { type: "array", items: { type: "string" } },
  },
  required: ["title", "labels", "findings", "checked"],
  additionalProperties: false,
};

export interface Review {
  title: string;
  labels: { summary: string; where: string; mistake: string; fix: string; checked: string };
  findings: Array<{ where: string; issue: string; fix: string; citations: string[] }>;
  checked: string[];
}

export function cell(text: string): string {
  return text.replace(/\s+/gu, " ").trim().replaceAll("|", "\\|");
}

export function renderReview(review: Review, packCitations: readonly string[]): string {
  const known = new Map(packCitations.map((citation) => [citation.trim().toLowerCase(), citation]));
  const rows = review.findings.map((finding, index) => {
    const cited = finding.citations.map(
      (citation) => known.get(citation.trim().toLowerCase()) ?? `${citation.trim()} (unverified)`,
    );
    const fix = cited.length === 0 ? finding.fix : `${finding.fix} — ${cited.join("; ")}`;
    return `| ${index + 1} | ${cell(finding.where)} | ${cell(finding.issue)} | ${cell(fix)} |`;
  });
  const { labels } = review;
  const header = `| # | ${cell(labels.where)} | ${cell(labels.mistake)} | ${cell(labels.fix)} |`;
  const table = `${header}\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
  return [
    `# Review ${cell(review.title)}`,
    cell(labels.summary),
    ...(rows.length === 0 ? [] : [table]),
    `${cell(labels.checked)}: ${review.checked.map(cell).join("; ")}`,
  ].join("\n\n");
}
