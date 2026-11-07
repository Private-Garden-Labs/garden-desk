import { fileURLToPath } from "node:url";
import { LAW_DISCLAIMER } from "@gardendesk/shared";
import { afterEach, expect, it } from "vitest";
import {
  chatResult,
  cleanServiceFixtures,
  fixture,
  outputExecution,
  terminal,
} from "../agent/service-test-support.js";
import type { ChatInput } from "../runtime/inference.js";

afterEach(cleanServiceFixtures);

const labels = {
  summary: "Mistakes found: 1.",
  where: "Where",
  mistake: "Mistake",
  fix: "Suggested fix",
  checked: "Checked with no issues",
};
const citations = [" regulation (eu) 2022/720, article 4", "Article 99"];
const finding = { where: "Art. 3", issue: "Minimum resale price.", fix: "Remove it.", citations };
const review = {
  title: "Distribution agreement",
  labels,
  findings: [finding],
  checked: ["Parties"],
};

it("keeps the document last and its request immediately before it when laws are supplied", async () => {
  const requests: ChatInput[] = [];
  const text = "The selected option costs 12.";
  const sections = [{ citation: "Article 22", heading: "Extra payments", source: "Act", text }];
  const { catalog, conversations, service } = await fixture(
    {
      chat: async (request) => {
        requests.push(request);
        return chatResult(
          JSON.stringify({ title: "Amounts", labels, findings: [], checked: [] }),
          [],
        );
      },
    },
    async (request) => outputExecution(request, text),
  );
  try {
    const session = conversations.createSession(null);
    await service.addAttachment(
      session.id,
      fileURLToPath(new URL("../../../../prompts/commands/review.md", import.meta.url)),
    );
    const run = service.start(session.id, "/review Check the amounts.", "medium", {
      laws: {
        id: "eu",
        name: "European Union",
        currentAsOf: "2026",
        searched: () => true,
        citations: () => [],
        search: async () => sections,
        forDocument: async () => sections,
      },
    });
    expect((await terminal(service, run.id)).run.state).toBe("succeeded");
    const messages = requests.at(-1)?.messages ?? [];
    const last = messages.at(-1);
    if (last?.role !== "user") throw new Error("Missing review source.");
    expect(JSON.parse(last.text)).toMatchObject({ source: "review.md", extractedText: text });
    expect(messages.at(-2)).toMatchObject({ role: "user", text: "Check the amounts." });
    expect(JSON.stringify(messages)).toContain("Article 22");
  } finally {
    await service.close();
    catalog.close();
  }
});

it("checks citations against the pack and delivers the rendered review as a report", async () => {
  const { catalog, conversations, service } = await fixture(
    {
      chat: async (request) =>
        chatResult(request.jsonSchema === undefined ? "[]" : JSON.stringify(review), []),
    },
    async (request) => ({
      ...outputExecution(request, "3: The buyer resells at no less than 10."),
      artifacts:
        request.language !== "shell" && request.path.endsWith("review-report.py")
          ? [{ name: "Review - review.md", mediaType: "text/markdown", bytesBase64: "cmV2aWV3" }]
          : [],
    }),
  );
  try {
    const session = conversations.createSession(null);
    await service.addAttachment(
      session.id,
      fileURLToPath(new URL("../../../../prompts/commands/review.md", import.meta.url)),
    );
    const run = service.start(session.id, "/review", "medium", {
      laws: {
        name: "European Union",
        currentAsOf: "2026",
        searched: () => true,
        citations: () => ["Regulation (EU) 2022/720, Article 4"],
        search: async () => [],
        forDocument: async () => [],
      },
    });
    const snapshot = await terminal(service, run.id);
    expect(snapshot.run.response).toBe(
      [
        "# Review Distribution agreement",
        "Mistakes found: 1.",
        "| # | Where | Mistake | Suggested fix |\n| --- | --- | --- | --- |\n| 1 | Art. 3 | Minimum resale price. | Remove it. — Regulation (EU) 2022/720, Article 4; Article 99 (unverified) |",
        "Checked with no issues: Parties",
        LAW_DISCLAIMER,
      ].join("\n\n"),
    );
    expect(snapshot.artifacts.map((artifact) => artifact.name)).toEqual(["Review - review.md"]);
  } finally {
    await service.close();
    catalog.close();
  }
});
