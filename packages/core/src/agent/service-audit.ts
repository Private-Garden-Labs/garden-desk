import type { AgentEvent, AgentRunResult, AgentRunSummary } from "@gardendesk/shared";
import type { AuditLog } from "../audit/log.js";
import type { ConversationStore } from "../conversations/store.js";
import type { JobStore } from "../jobs/jobs.js";
import type { DatabasePort } from "../workspace/database.js";
import { agentFailureEvent, agentFailureText, runPerformance } from "./service-results.js";
import type { AgentStore } from "./store.js";

interface RunPersistencePorts {
  audit: AuditLog;
  conversations: ConversationStore;
  database: DatabasePort;
  jobs: JobStore;
  store: AgentStore;
}

const MAX_RECORDED_TOOL_STEPS = 12;

function interruptedRunRecord(summary: string, events: AgentEvent[]): string {
  const steps = events
    .filter((event) => event.type === "tool.completed")
    .slice(-MAX_RECORDED_TOOL_STEPS)
    .map((event) => `- ${event.summary}`);
  return steps.length === 0
    ? summary
    : `${summary} Work done before the stop:\n${steps.join("\n")}`;
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

export function persistFailedRun(
  ports: RunPersistencePorts,
  run: AgentRunSummary,
  signal: AbortSignal,
  error: unknown,
): void {
  const cancelled = signal.aborted || ports.jobs.isCancellationRequested(run.jobId);
  const state = cancelled ? "cancelled" : "failed";
  const detail = cancelled ? "cancelled" : agentFailureText(error);
  const event = agentFailureEvent(cancelled, detail);
  const record = interruptedRunRecord(event.summary, ports.store.snapshot(run.id).events);
  ports.database.transaction(() => {
    ports.store.execution.failIncomplete(run.id, cancelled);
    ports.store.transitionRun(run.id, { state, error: detail });
    ports.conversations.appendMessage(run.sessionId, "assistant", record, run.id);
    if (!cancelled) ports.jobs.transition(run.jobId, "failed");
    ports.store.appendEvent(run.id, event.type, event.summary, event.detail);
  })();
  ports.audit.append({
    type: "agent.completed",
    outcome: "failed",
    metadata: { runId: run.id, jobId: run.jobId, code: detail },
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
