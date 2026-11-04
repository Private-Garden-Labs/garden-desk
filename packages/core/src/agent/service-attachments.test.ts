import { fileURLToPath } from "node:url";
import type { CodeAgentSession } from "@gardendesk/workers";
import { afterEach, expect, it, vi } from "vitest";
import type { ChatInput } from "../runtime/inference.js";
import {
  chatResult,
  cleanServiceFixtures,
  fixture,
  fixtureWithLauncher,
  outputExecution,
  terminal,
} from "./service-test-support.js";

afterEach(cleanServiceFixtures);

it("adds an attachment while another session is still warming", async () => {
  let finishWarmUp = (): void => undefined;
  const guest: CodeAgentSession = {
    execute: () => Promise.reject(new Error("unexpected_execution")),
    async cancel() {},
    async close() {},
  };
  const { catalog, conversations, service } = await fixtureWithLauncher(
    {},
    {
      openAgentSession: () =>
        new Promise<CodeAgentSession>((accept) => {
          finishWarmUp = () => accept(guest);
        }),
      async deleteWorkspace() {},
    },
  );
  let timer: NodeJS.Timeout | undefined;
  try {
    void service.warmSession(conversations.createSession(null).id);
    const session = conversations.createSession(null);
    const attached = await Promise.race([
      service.addAttachment(session.id, fileURLToPath(import.meta.url)),
      new Promise<"timeout">((accept) => {
        timer = setTimeout(() => accept("timeout"), 500);
      }),
    ]);
    expect(attached).toMatchObject({ sessionId: session.id });
  } finally {
    clearTimeout(timer);
    finishWarmUp();
    await service.close();
    catalog.close();
  }
});

it("asks for the review in the selected interface language", async () => {
  const chat = vi.fn().mockResolvedValue(chatResult("# Revizuire contract\n\nText.", []));
  const { catalog, conversations, service } = await fixture({ chat }, async (request) =>
    outputExecution(request, "1: Contract de prestări servicii."),
  );
  try {
    const session = conversations.createSession(null);
    await service.addAttachment(
      session.id,
      fileURLToPath(new URL("../../../../prompts/commands/review.md", import.meta.url)),
    );
    await terminal(service, service.start(session.id, "/review", "medium", "Romanian").id);
    const input = chat.mock.calls[0]?.[0] as ChatInput;
    expect(input.messages[0]).toMatchObject({ text: expect.stringContaining("Romanian") });
  } finally {
    await service.close();
    catalog.close();
  }
});
