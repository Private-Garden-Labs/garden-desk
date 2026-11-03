// biome-ignore lint/style/noRestrictedImports: the test uses an isolated temporary catalog.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { AgentService } from "../agent/service.js";
import { AuditLog } from "../audit/log.js";
import { createConversationPorts } from "../conversation-ports.js";
import { openWorkspaceCatalog } from "../workspace/catalog.js";
import { ConversationStore } from "./store.js";

it("keeps the conversation when workspace cleanup fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "garden-desk-delete-failure-"));
  const catalog = openWorkspaceCatalog(root);
  try {
    const store = new ConversationStore(catalog.database);
    const session = store.createSession(null);
    const agent = {
      closeSession: async (_sessionId: string, deleteWorkspace = false) => {
        if (deleteWorkspace) throw new Error("workspace_cleanup_failed");
      },
    } as unknown as AgentService;
    const ports = createConversationPorts(
      store,
      new AuditLog(catalog.database),
      catalog.database,
      agent,
    );

    await expect(ports.deleteSession(session.id)).rejects.toThrow("workspace_cleanup_failed");
    expect(store.listSessions(null).items).toEqual([session]);
  } finally {
    catalog.close();
    rmSync(root, { force: true, recursive: true });
  }
});
