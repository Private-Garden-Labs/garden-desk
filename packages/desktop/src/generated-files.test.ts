import { AgentArtifactSummarySchema } from "@gardendesk/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeneratedFiles } from "./components/generated-files.js";

const report = AgentArtifactSummarySchema.parse({
  id: "6ad824dc-bd7a-431a-9b2a-e79cdb8a98fe",
  runId: "77ff5b22-555d-4ef2-9170-fdd7118738f1",
  name: "report.csv",
  mediaType: "text/csv",
  byteLength: 42,
  contentHash: `sha256:${"a".repeat(64)}`,
  createdAt: "2026-07-20T12:00:05.000Z",
});
const workbook = AgentArtifactSummarySchema.parse({
  ...report,
  id: "6ad824dc-bd7a-431a-9b2a-e79cdb8a98ff",
  name: "totals.xlsx",
  mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  byteLength: 2_048,
});

describe("generated file cards", () => {
  it("shows recognizable file types and disables native actions in the public demo", () => {
    const markup = renderToStaticMarkup(
      createElement(GeneratedFiles, {
        artifacts: [report, workbook],
        disabledReason: "Unavailable in the public demo",
        onOpen: async () => undefined,
        onSave: async () => "cancelled" as const,
      }),
    );

    expect(markup).toContain("report.csv");
    expect(markup).toContain("totals.xlsx");
    expect(markup).toContain("Excel workbook · 2.0 KB");
    expect(markup).toMatch(/aria-label="Open totals.xlsx"[^>]*disabled/);
    expect(markup).toContain('title="Unavailable in the public demo"');
    expect(markup).toContain('aria-live="polite"');
  });

  it("hides code files and shows no section when only code files exist", () => {
    const script = AgentArtifactSummarySchema.parse({
      ...report,
      id: "6ad824dc-bd7a-431a-9b2a-e79cdb8a9900",
      name: "feb2025.py",
      mediaType: "application/octet-stream",
    });
    const bytecode = AgentArtifactSummarySchema.parse({
      ...script,
      id: "6ad824dc-bd7a-431a-9b2a-e79cdb8a9901",
      name: "__pycache__/inspect.cpython-314.pyc",
    });
    const render = (artifacts: (typeof report)[]) =>
      renderToStaticMarkup(
        createElement(GeneratedFiles, {
          artifacts,
          disabledReason: undefined,
          onOpen: async () => undefined,
          onSave: async () => "cancelled" as const,
        }),
      );

    expect(render([script, bytecode])).toBe("");
    const markup = render([script, bytecode, report]);
    expect(markup).toContain("report.csv");
    expect(markup).not.toContain("feb2025.py");
    expect(markup).not.toContain("inspect.cpython-314.pyc");
  });
});
