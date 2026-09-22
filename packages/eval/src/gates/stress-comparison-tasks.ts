import { join } from "node:path";
import {
  createDocxCorpus,
  createPdf,
  createXlsxCorpus,
  PDF_PAGE_TARGET,
  WORD_PAGE_TARGET,
  XLSX_TARGET,
} from "../stress/document-fixtures.js";
import { cases as obligations } from "../stress/specialist-contract-obligations.js";
import { cases as comparison } from "../stress/specialist-document-comparison.js";
import { cases as brief } from "../stress/specialist-evidence-brief.js";
import { cases as reconciliation } from "../stress/specialist-financial-reconciliation.js";
import { cases as extraction } from "../stress/specialist-financial-record-extraction.js";
import { prepareSpecialistFiles, type SpecialistCase } from "../stress/specialist-fixtures.js";
import { cases as intake } from "../stress/specialist-folder-intake.js";
import { cases as expenses } from "../stress/specialist-invoice-expense-review.js";
import { cases as chronology } from "../stress/specialist-matter-chronology.js";

const SPECIALIST_SUFFIX =
  "\nUse the source files in /source. Write a concise final report to /workspace/result.md with the facts requested and source file references with page, paragraph, or row locations. Return a short summary. Do not change the source files.";

export interface StressTask {
  id: string;
  suite: "golden" | "specialist";
  agentId: string | null;
  deliverable: string;
  expectation: string;
  prompt: string;
  prepare(sourceDir: string): Promise<unknown>;
  afterGrant(sourceDir: string): Promise<unknown>;
  check(text: string): { facts: number; sources: number };
}

function coverage(report: string, values: string[]): number {
  if (values.length === 0) return 1;
  return values.filter((value) => report.includes(value)).length / values.length;
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
    check: (text) => ({
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
    check: (text) => ({
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
    check: (text) => ({
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
    check: (text) => ({
      facts: coverage(text, ["workbook-001.xlsx", "document-001.docx", "policy-brief.pdf"]),
      sources: 1,
    }),
  },
];

const specialistCases: SpecialistCase[] = [
  ...intake,
  ...chronology,
  ...obligations,
  ...comparison,
  ...extraction,
  ...reconciliation,
  ...expenses,
  ...brief,
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
  check: (text) => ({
    facts: coverage(text, Object.values(task.expected).map(String)),
    sources: coverage(text, task.sources),
  }),
}));

export function stressTasks(filter: { suite?: string; ids?: string[] }): StressTask[] {
  return [...goldenTasks, ...specialistTasks].filter(
    (task) =>
      (filter.suite === undefined || task.suite === filter.suite) &&
      (filter.ids === undefined || filter.ids.includes(task.id)),
  );
}
