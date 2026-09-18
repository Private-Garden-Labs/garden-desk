import type { AgentGuestStart, AgentRunSnapshot, AgentRunSummary } from "@gardendesk/shared";
import type { PendingQuestion } from "./agent-questions.js";
import type { AgentStore } from "./store.js";

export interface ActiveRun {
  controller: AbortController;
  finished: Promise<void>;
  runId: string;
  sessionId: string;
  thinking: string | null;
  response: string | null;
  question?: PendingQuestion | null;
}

export function withActiveRun(
  snapshot: AgentRunSnapshot,
  active: ActiveRun | undefined,
  activeChild?: ActiveRun,
) {
  return {
    ...snapshot,
    run: active === undefined ? snapshot.run : { ...snapshot.run, response: active.response },
    thinking: active?.thinking ?? activeChild?.thinking ?? null,
    question: active?.question?.request ?? null,
  };
}

export function activeRunSnapshot(
  store: Pick<AgentStore, "snapshot">,
  activeRuns: Iterable<ActiveRun>,
  runId: string,
): AgentRunSnapshot {
  const runs = [...activeRuns];
  const snapshot = store.snapshot(runId);
  const children = new Set<string>(snapshot.childRuns.map((child) => child.id));
  return withActiveRun(
    snapshot,
    runs.find((run) => run.runId === runId),
    runs.find((run) => children.has(run.runId) && run.thinking !== null),
  );
}

/** The last microVM start whose time span overlapped the run, so the run waited for it. */
export function guestStartDuring(
  starts: readonly AgentGuestStart[],
  run: AgentRunSummary,
): AgentGuestStart | null {
  const runBegan = Date.parse(run.createdAt);
  const working = run.state === "queued" || run.state === "running";
  const runEnded = working ? Number.POSITIVE_INFINITY : Date.parse(run.updatedAt);
  return (
    starts.findLast((start) => {
      const began = Date.parse(start.startedAt);
      const ended = start.durationMs === null ? Number.POSITIVE_INFINITY : began + start.durationMs;
      return began <= runEnded && ended >= runBegan;
    }) ?? null
  );
}
