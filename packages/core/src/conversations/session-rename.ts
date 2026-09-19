import type { AuditLog } from "../audit/log.js";
import type { DatabasePort } from "../workspace/database.js";

export function renameConversationSession(
  audit: AuditLog,
  database: DatabasePort,
  rename: { sessionId: string; title: string },
): boolean {
  return database.transaction(() => {
    const renamed =
      database
        .prepare("UPDATE sessions SET title = ? WHERE id = ?")
        .run(rename.title, rename.sessionId).changes === 1;
    audit.append({
      type: "session.renamed",
      outcome: renamed ? "succeeded" : "failed",
      metadata: { sessionId: rename.sessionId },
    });
    return renamed;
  })();
}
