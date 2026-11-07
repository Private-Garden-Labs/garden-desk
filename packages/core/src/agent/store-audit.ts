import type {
  AgentArtifactSummary,
  AgentEvent,
  AgentEventDetail,
  AuditEventInput,
} from "@gardendesk/shared";
import type { DatabasePort } from "../workspace/database.js";
import type { TraceAuditAppender } from "./trace-store.js";

function appendRunAudit(
  database: DatabasePort,
  audit: TraceAuditAppender,
  event: AuditEventInput & { runId: string },
): void {
  const { runId, ...input } = event;
  const run = database.prepare("SELECT session_id FROM agent_runs WHERE id = ?").get(runId) as {
    session_id: string;
  };
  audit({ ...input, metadata: { sessionId: run.session_id, runId, ...input.metadata } });
}

export function auditAgentEvent(
  database: DatabasePort,
  audit: TraceAuditAppender,
  event: AgentEvent,
  detail: Partial<AgentEventDetail>,
): void {
  if (event.type === "tool.completed")
    appendRunAudit(database, audit, {
      runId: event.runId,
      type: "tool.called",
      outcome: detail.toolFailed === true ? "failed" : "succeeded",
      metadata: { tool: event.toolName, argumentsHash: detail.argumentsHash ?? null },
    });
  if (event.type === "question.answered")
    appendRunAudit(database, audit, {
      runId: event.runId,
      type: "question.answered",
      outcome: event.stdout === "dismissed" ? "denied" : "allowed",
    });
}

export function auditArtifactCreated(
  database: DatabasePort,
  audit: TraceAuditAppender,
  artifact: AgentArtifactSummary,
): void {
  appendRunAudit(database, audit, {
    runId: artifact.runId,
    type: "artifact.created",
    outcome: "succeeded",
    metadata: { artifactId: artifact.id, bytes: artifact.byteLength },
  });
}
