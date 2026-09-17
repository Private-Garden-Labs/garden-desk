import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readSourceFiles } from "../prompt-files.js";

const FORBIDDEN =
  /\b(?:xlsx|docx|pdf|openpyxl|pypdf|python-docx|reportlab|avans|salari|tranzac)\b/iu;
const ALLOWED = new Set(
  [
    "packages/core/src/agent/document-text-source.ts",
    "packages/core/src/agent/generic-tool-support.ts",
    "packages/core/src/agent/records.ts",
    "packages/core/src/agent/review-tool.ts",
  ].map((path) => resolve(process.cwd(), path)),
);

describe("generic agent architecture boundary", () => {
  it("keeps document-format policy out of core and shared implementation sources", () => {
    const roots = [
      resolve(process.cwd(), "packages/core/src/agent"),
      resolve(process.cwd(), "packages/shared/src"),
    ];
    const violations = roots
      .flatMap(readSourceFiles)
      .filter(({ path }) => !ALLOWED.has(path) && !path.includes("test-support"))
      .flatMap(({ path, content }) => {
        const match = FORBIDDEN.exec(content);
        return match === null ? [] : [`${path}: ${match[0]}`];
      });
    expect(violations).toEqual([]);
  });
});
