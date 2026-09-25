import { join } from "node:path";
import { cases as direct } from "../stress/direct-work-cases.js";
import {
  createDocxCorpus,
  createPdf,
  createXlsxCorpus,
  PDF_PAGE_TARGET,
  WORD_PAGE_TARGET,
  XLSX_TARGET,
} from "../stress/document-fixtures.js";
import { type FileCheck, salaryWorkbook, storyDocx, storyPdf } from "../stress/generated-files.js";
import { cases as obligations } from "../stress/specialist-contract-obligations.js";
import { cases as comparison } from "../stress/specialist-document-comparison.js";
import { cases as reconciliation } from "../stress/specialist-financial-reconciliation.js";
import { prepareSpecialistFiles, type SpecialistCase } from "../stress/specialist-fixtures.js";
import { cases as expenses } from "../stress/specialist-invoice-expense-review.js";
import { cases as chronology } from "../stress/specialist-matter-chronology.js";

const SPECIALIST_SUFFIX =
  "\nUse the source files in /source. Write a concise final report to /workspace/result.md with the facts requested and source file references with page, paragraph, or row locations. Return a short summary. Do not change the source files.";

export interface StressTask {
  id: string;
  suite: "golden" | "specialist" | "generation";
  agentId: string | null;
  deliverable: string;
  expectation: string;
  prompt: string;
  prepare(sourceDir: string): Promise<unknown>;
  afterGrant(sourceDir: string): Promise<unknown>;
  check(output: Deliverable): { facts: number; sources: number; note?: string };
}

export interface Deliverable {
  bytes: Buffer;
  text: string;
  skills: string[];
}

/** A task whose deliverable is the first artifact with this extension. */
export function deliverableMatches(deliverable: string, name: string): boolean {
  return (
    name === deliverable ||
    (deliverable.startsWith(".") && name.toLowerCase().endsWith(deliverable))
  );
}

function coverage(report: string, values: string[]): number {
  if (values.length === 0) return 1;
  return values.filter((value) => report.includes(value)).length / values.length;
}

/** A fact matches when its list items appear in order; thousands separators are ignored. */
function factCoverage(report: string, expected: Record<string, unknown>): number {
  const text = report.replace(/(\d),(?=\d{3}\b)/gu, "$1");
  const facts = Object.values(expected).map((value) =>
    (Array.isArray(value) ? value : [value]).map(String),
  );
  if (facts.length === 0) return 1;
  const found = facts.filter((items) => {
    let position = 0;
    return items.every((item) => {
      const index = text.indexOf(item, position);
      position = index + item.length;
      return index >= 0;
    });
  });
  return found.length / facts.length;
}

const goldenTasks: StressTask[] = [
  {
    id: "xlsx-extraction",
    suite: "golden",
    agentId: null,
    deliverable: "summary.txt",
    expectation: `summary.txt contains "${XLSX_TARGET}" and "1001"`,
    prompt:
      "Read the spreadsheet in /source and write a short plain-text summary to /workspace/summary.txt with the note and the amount on the row marked as a priority review.",
    prepare: (sourceDir) => createXlsxCorpus(sourceDir, { files: 1, sheets: 1, rowsPerSheet: 8 }),
    afterGrant: async () => undefined,
    check: ({ text }) => ({
      facts: coverage(text, [XLSX_TARGET, "1001"]),
      sources: 1,
    }),
  },
  {
    id: "docx-extraction",
    suite: "golden",
    agentId: null,
    deliverable: "summary.txt",
    expectation: `summary.txt contains "${WORD_PAGE_TARGET}" and "checksum=1003"`,
    prompt:
      "Read the Word document in /source and write a short plain-text summary to /workspace/summary.txt with the total page count and the exact text of the last page.",
    prepare: (sourceDir) => createDocxCorpus(sourceDir, { files: 1, pagesPerFile: 3 }),
    afterGrant: async () => undefined,
    check: ({ text }) => ({
      facts: coverage(text, [WORD_PAGE_TARGET, "checksum=1003"]),
      sources: 1,
    }),
  },
  {
    id: "pdf-extraction",
    suite: "golden",
    agentId: null,
    deliverable: "summary.txt",
    expectation: `summary.txt is plain text containing "${PDF_PAGE_TARGET}" and "checksum=51"`,
    prompt:
      "Read the PDF in /source and write a short plain-text summary to /workspace/summary.txt with the total page count and the exact text on the last page.",
    prepare: (sourceDir) => createPdf(join(sourceDir, "policy-brief.pdf"), 3),
    afterGrant: async () => undefined,
    check: ({ text }) => ({
      facts: text.startsWith("%PDF") ? 0 : coverage(text, [PDF_PAGE_TARGET, "checksum=51"]),
      sources: 1,
    }),
  },
  {
    id: "mixed-folder-report",
    suite: "golden",
    agentId: null,
    deliverable: "report.txt",
    expectation: "report.txt lists all three source file names",
    prompt:
      "Look at the different documents in /source and write a short plain-text report to /workspace/report.txt listing each file's exact name.",
    prepare: async (sourceDir) => {
      await createXlsxCorpus(sourceDir, { files: 1, sheets: 1, rowsPerSheet: 4 });
      await createDocxCorpus(sourceDir, { files: 1, pagesPerFile: 1 });
      await createPdf(join(sourceDir, "policy-brief.pdf"), 1);
    },
    afterGrant: async () => undefined,
    check: ({ text }) => ({
      facts: coverage(text, ["workbook-001.xlsx", "document-001.docx", "policy-brief.pdf"]),
      sources: 1,
    }),
  },
];

const specialistCases: SpecialistCase[] = [
  ...direct,
  ...chronology,
  ...obligations,
  ...comparison,
  ...reconciliation,
  ...expenses,
].filter((item) => item.command === undefined);

const specialistTasks: StressTask[] = specialistCases.map((task) => ({
  id: task.id,
  suite: "specialist",
  agentId: task.agentId,
  deliverable: "result.md",
  expectation: Object.values(task.expected).map(String).join(" | "),
  prompt: `${task.request}${SPECIALIST_SUFFIX}`,
  prepare: (sourceDir) => prepareSpecialistFiles(sourceDir, task.files),
  afterGrant: (sourceDir) => prepareSpecialistFiles(sourceDir, task.addedAfterGrant ?? {}),
  check: ({ text }) => ({
    facts: factCoverage(text, task.expected),
    sources: coverage(text, task.sources),
  }),
}));

function generationTask(input: {
  id: string;
  prompt: string;
  skill: string;
  extension: string;
  content: string;
  inspect(bytes: Buffer): FileCheck;
}): StressTask {
  return {
    id: input.id,
    suite: "generation",
    agentId: null,
    deliverable: input.extension,
    expectation: `loads ${input.skill}, writes a ${input.extension} file, ${input.content}`,
    prompt: input.prompt,
    prepare: async () => undefined,
    afterGrant: async () => undefined,
    check: ({ bytes, skills }) => {
      const file = input.inspect(bytes);
      const checks = [skills.includes(input.skill), file.type, file.content];
      return {
        facts: checks.filter(Boolean).length / checks.length,
        sources: 1,
        note: `skills: ${skills.join(", ") || "none"}; ${file.note}`,
      };
    },
  };
}

const generationTasks: StressTask[] = [
  generationTask({
    id: "pdf-story",
    prompt: "Generate a pdf with a nice story about a cat and a mouse",
    skill: "pdf-documents",
    extension: ".pdf",
    content: "with at least 750 characters of story text",
    inspect: storyPdf,
  }),
  generationTask({
    id: "docx-story",
    prompt: "Generate a document with a nice story about the golden fish",
    skill: "word-documents",
    extension: ".docx",
    content: "with at least 3 story paragraphs of 40 or more letters",
    inspect: storyDocx,
  }),
  generationTask({
    id: "xlsx-salaries",
    prompt:
      "Generate an excel with 5 columns and 12 rows. Each column is the name of a person and the rows are their monthly salary from January to December. Salaries are in USD and range from 2000 to 10000.",
    skill: "xlsx-workbooks",
    extension: ".xlsx",
    content: "with 5 name headers over 12 rows of 5 salaries from 2000 to 10000",
    inspect: salaryWorkbook,
  }),
];

export function stressTasks(filter: { suite?: string; ids?: string[] }): StressTask[] {
  return [...goldenTasks, ...specialistTasks, ...generationTasks].filter(
    (task) =>
      (filter.suite === undefined || task.suite === filter.suite) &&
      (filter.ids === undefined || filter.ids.includes(task.id)),
  );
}
