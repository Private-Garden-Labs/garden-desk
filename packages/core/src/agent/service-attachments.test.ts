import { fileURLToPath } from "node:url";
import type { CodeAgentSession } from "@gardendesk/workers";
import { afterEach, expect, it } from "vitest";
import { cleanServiceFixtures, fixtureWithLauncher } from "./service-test-support.js";

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
