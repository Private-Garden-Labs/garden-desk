import { fileURLToPath } from "node:url";
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

it("keeps the document last and its request immediately before it when laws are supplied", async () => {
  const requests: ChatInput[] = [];
  const text = "The selected option costs 12.";
  const sections = [{ citation: "Article 22", heading: "Extra payments", source: "Act", text }];
  const { catalog, conversations, service } = await fixture(
    {
      chat: async (request) => {
        requests.push(request);
        return chatResult("Review.", []);
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
        name: "European Union",
        currentAsOf: "2026",
        searched: () => true,
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
