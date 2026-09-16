import type { AgentRunResult, AgentRunSummary } from "@gardendesk/shared";
import type { AuditLog } from "../audit/log.js";
import type { ConversationStore } from "../conversations/store.js";
import type { JobStore } from "../jobs/jobs.js";
import type { DatabasePort } from "../workspace/database.js";
import { runPerformance } from "./service-results.js";
import type { AgentStore } from "./store.js";

interface RunPersistencePorts {
  audit: AuditLog;
  conversations: ConversationStore;
  database: DatabasePort;
  jobs: JobStore;
  store: AgentStore;
}

export function persistSuccessfulRun(
  ports: RunPersistencePorts,
  run: AgentRunSummary,
  result: AgentRunResult,
  deliverables: Array<Parameters<AgentStore["addArtifact"]>[1]>,
): void {
  const performance = runPerformance(result, run.createdAt);
  ports.database.transaction(() => {
    ports.conversations.appendMessage(run.sessionId, "assistant", result.response, run.id);
    for (const deliverable of deliverables) ports.store.addArtifact(run.id, deliverable);
    ports.store.transitionRun(run.id, {
      state: "succeeded",
      response: result.response,
      performance,
    });
    ports.jobs.transition(run.jobId, "succeeded");
  })();
  appendSuccessfulRunAudit(ports.audit, run, {
    executions: ports.store.execution.list(run.id).length,
    guestExecutions: result.guestExecutions,
  });
}

export function appendSuccessfulRunAudit(
  audit: AuditLog,
  run: AgentRunSummary,
  counts: { executions: number; guestExecutions: number },
): void {
  audit.append({
    type: "agent.completed",
    outcome: "succeeded",
    metadata: {
      runId: run.id,
      jobId: run.jobId,
      executions: counts.executions,
      guestExecutions: counts.guestExecutions,
    },
  });
}
