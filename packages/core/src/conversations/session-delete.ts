import type { DatabasePort } from "../workspace/database.js";

export function canDeleteConversationSession(database: DatabasePort, sessionId: string): boolean {
  const running = database
    .prepare(
      "SELECT 1 FROM agent_runs WHERE session_id = ? AND state IN ('queued', 'running') LIMIT 1",
    )
    .get(sessionId);
  if (running !== undefined) throw new Error("session_busy");
  return Boolean(database.prepare("SELECT 1 FROM sessions WHERE id = ?").get(sessionId));
}
