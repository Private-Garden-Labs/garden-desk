import type { AgentService } from "./agent/service.js";
import type { AuditLog } from "./audit/log.js";
import {
  addFolderGrant,
  deleteConversationSession,
  warmConversationSession,
} from "./conversations/lifecycle.js";
import { renameConversationSession } from "./conversations/session-rename.js";
import type { ConversationStore } from "./conversations/store.js";
import type { GardenDeskCorePorts } from "./facade.js";
import type { openWorkspaceCatalog } from "./workspace/catalog.js";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the explicit port list keeps each authority visible at assembly.
export function createConversationPorts(
  conversations: ConversationStore,
  audit: AuditLog,
  database: ReturnType<typeof openWorkspaceCatalog>["database"],
  agent?: AgentService,
): Pick<
  GardenDeskCorePorts,
  | "addFolder"
  | "listFolders"
  | "reorderFolders"
  | "resolveFolderPath"
  | "revokeFolder"
  | "createSession"
  | "deleteSession"
  | "renameSession"
  | "listSessions"
  | "appendMessage"
  | "listMessages"
> {
  return {
    async addFolder(rootPath) {
      return addFolderGrant(conversations, audit, database, rootPath);
    },
    listFolders: async () => conversations.listFolders(),
    async reorderFolders(folderIds) {
      const folders = conversations.reorderFolders(folderIds);
      audit.append({
        type: "folders.reordered",
        outcome: "succeeded",
        metadata: { folderCount: folderIds.length },
      });
      return folders;
    },
    resolveFolderPath: async (folderId) => conversations.resolveFolderPath(folderId),
    async revokeFolder(folderId) {
      for (const sessionId of conversations.sessionIdsForFolder(folderId)) {
        await agent?.closeSession(sessionId);
      }
      const revoked = conversations.revokeFolder(folderId);
      audit.append({
        type: "folder.revoked",
        outcome: revoked ? "succeeded" : "failed",
        metadata: { folderId },
      });
      return revoked;
    },
    async createSession(folderId) {
      return database.transaction(() => {
        const session = conversations.createSession(folderId);
        audit.append({
          type: "session.created",
          outcome: "succeeded",
          metadata: { sessionId: session.id, folderId: session.folderId },
        });
        return session;
      })();
    },
    async deleteSession(sessionId) {
      await agent?.closeSession(sessionId);
      const deleted = deleteConversationSession(conversations, audit, database, sessionId);
      if (deleted) await agent?.closeSession(sessionId, true);
      return deleted;
    },
    async renameSession(sessionId, title) {
      return renameConversationSession(audit, database, { sessionId, title });
    },
    async listSessions(folderId, cursor, limit) {
      return conversations.listSessions(folderId, cursor, limit);
    },
    async appendMessage(sessionId, role, content) {
      return database.transaction(() => {
        const entry = conversations.appendMessage(sessionId, role, content);
        audit.append({
          type: "message.appended",
          outcome: "succeeded",
          metadata: { sessionId, role },
        });
        return entry;
      })();
    },
    async listMessages(sessionId) {
      warmConversationSession(agent, audit, sessionId);
      return conversations.listMessages(sessionId);
    },
  };
}
