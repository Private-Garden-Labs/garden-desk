import { readFile } from "node:fs/promises";
import type { GardenDeskCore } from "@gardendesk/core";
import type { AgentRunSnapshot, ModelRuntimeStatus } from "@gardendesk/shared";
import { deliverableMatches } from "./stress-comparison-tasks.js";

const HIDDEN_EVENTS = new Set([
  "run.started",
  "assistant.completed",
  "question.asked",
  "question.answered",
]);

export function visibleSteps(events: { type: string }[]): number {
  return events.filter((event) => !HIDDEN_EVENTS.has(event.type)).length;
}

export async function deliverableBytes(
  core: GardenDeskCore,
  deliverable: string,
  snapshot: AgentRunSnapshot,
): Promise<Buffer> {
  const artifact = snapshot.artifacts.find((item) => deliverableMatches(deliverable, item.name));
  if (artifact === undefined) return Buffer.alloc(0);
  try {
    return await readFile(await core.materializeArtifact(snapshot.run.sessionId, artifact.id));
  } catch {
    return Buffer.alloc(0);
  }
}

export function loadedSkills(events: AgentRunSnapshot["events"]): string[] {
  return events.flatMap((event) => {
    const loaded = event.type === "tool.completed" && event.toolName === "skill";
    const name = loaded ? /^Loaded (.+) skill\.$/u.exec(event.summary)?.[1] : undefined;
    return name === undefined ? [] : [name];
  });
}

export function allocatedMemory(status: ModelRuntimeStatus | undefined): number {
  if (status === undefined) return 0;
  return (status.cpuRamBytes ?? 0) + (status.gpuMemoryBytes ?? 0);
}

const LOOP_WINDOW = 10;
const LOOP_REPEATS = 4;

function callKeys(events: AgentRunSnapshot["events"]): string[] {
  const started = new Map<string, string>();
  const keys: string[] = [];
  for (const event of events) {
    if (event.toolCallId === null) continue;
    if (event.type === "tool.started") {
      started.set(
        event.toolCallId,
        [event.toolName, event.command, event.source, event.path].join("|"),
      );
    }
    if (event.type === "tool.completed") {
      keys.push(`${started.get(event.toolCallId) ?? event.toolName}|${event.stdout ?? ""}`);
    }
  }
  return keys;
}

/** A tool call with the same input and the same result, repeated inside the recent calls. */
function repeatedCall(events: AgentRunSnapshot["events"]): string | undefined {
  const counts = new Map<string, number>();
  for (const key of callKeys(events).slice(-LOOP_WINDOW)) {
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count >= LOOP_REPEATS) return key;
  }
  return undefined;
}

async function loopingCall(
  core: GardenDeskCore,
  snapshot: AgentRunSnapshot,
): Promise<string | undefined> {
  const own = repeatedCall(snapshot.events);
  if (own !== undefined) return own;
  for (const child of snapshot.childRuns) {
    if (child.state !== "running") continue;
    const childSnapshot = await core.getAgentRun(child.id).catch(() => undefined);
    const key = childSnapshot === undefined ? undefined : repeatedCall(childSnapshot.events);
    if (key !== undefined) return key;
  }
  return undefined;
}

/** Liveness across the whole run tree, so an active specialist child is never read as a stall. */
async function progressSignature(
  core: GardenDeskCore,
  snapshot: AgentRunSnapshot,
  steps: number,
): Promise<string> {
  const children: string[] = [];
  for (const child of snapshot.childRuns) {
    const events =
      child.state === "running"
        ? ((await core.getAgentRun(child.id).catch(() => undefined))?.events.length ?? 0)
        : 0;
    children.push(`${child.id}:${child.state}:${events}`);
  }
  return `${steps}|${snapshot.executions.length}|${snapshot.contextUsedTokens ?? 0}|${children}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((accept) => setTimeout(accept, ms));
}

async function betterStatus(
  core: GardenDeskCore,
  best: ModelRuntimeStatus | undefined,
): Promise<ModelRuntimeStatus | undefined> {
  const status = await core.modelStatus().catch(() => undefined);
  const loaded = status !== undefined && (status.state === "ready" || status.state === "busy");
  return loaded && (best === undefined || allocatedMemory(status) > allocatedMemory(best))
    ? status
    : best;
}

function logProgress(input: {
  taskId: string;
  snapshot: AgentRunSnapshot;
  steps: number;
  began: number;
  lastStepChange: number;
}): void {
  const now = Date.now();
  console.log(
    JSON.stringify({
      stage: "progress",
      case: input.taskId,
      state: input.snapshot.run.state,
      steps: input.steps,
      executions: input.snapshot.executions.length,
      children: input.snapshot.childRuns.length,
      contextUsed: input.snapshot.contextUsedTokens,
      elapsedS: Math.round((now - input.began) / 1000),
      sinceStepS: Math.round((now - input.lastStepChange) / 1000),
    }),
  );
}

export interface Watched {
  snapshot: AgentRunSnapshot;
  stop: "terminal" | "stalled" | "timeout" | "loop";
  loopCall: string | null;
  questions: number;
  status: ModelRuntimeStatus | undefined;
  steps: number;
}

export interface WatchOptions {
  core: GardenDeskCore;
  taskId: string;
  runId: string;
  jobId: string;
  began: number;
  caseLimitMs: number;
  stepStallMs: number;
}

function stopReason(
  now: number,
  began: number,
  lastStepChange: number,
  limits: { caseLimitMs: number; stepStallMs: number },
): Watched["stop"] | undefined {
  if (now - lastStepChange > limits.stepStallMs) return "stalled";
  if (now - began > limits.caseLimitMs) return "timeout";
  return undefined;
}

async function dismissPendingQuestion(
  core: GardenDeskCore,
  runId: string,
  snapshot: AgentRunSnapshot,
): Promise<number> {
  if (snapshot.question === null) return 0;
  await core.dismissQuestion(runId, snapshot.question.id);
  return 1;
}

async function settle(input: {
  core: GardenDeskCore;
  taskId: string;
  runId: string;
  jobId: string;
}): Promise<AgentRunSnapshot> {
  await input.core.cancelAgent(input.jobId).catch(() => false);
  await sleep(2_000);
  return await input.core.getAgentRun(input.runId);
}

interface PollState {
  steps: number;
  signature: string;
  lastStepChange: number;
  lastLog: number;
  polls: number;
  questions: number;
  best: ModelRuntimeStatus | undefined;
}

async function poll(
  options: WatchOptions,
  state: PollState,
  snapshot: AgentRunSnapshot,
): Promise<void> {
  const { core, runId, taskId, began } = options;
  state.questions += await dismissPendingQuestion(core, runId, snapshot);
  state.steps = visibleSteps(snapshot.events);
  const signature = await progressSignature(core, snapshot, state.steps);
  if (signature !== state.signature) {
    state.signature = signature;
    state.lastStepChange = Date.now();
  }
  state.polls += 1;
  if (state.polls % 5 === 1) state.best = await betterStatus(core, state.best);
  if (Date.now() - state.lastLog >= 15_000) {
    state.lastLog = Date.now();
    logProgress({
      taskId,
      snapshot,
      steps: state.steps,
      began,
      lastStepChange: state.lastStepChange,
    });
  }
}

export async function watch(options: WatchOptions): Promise<Watched> {
  const { core, taskId, runId, jobId, began } = options;
  const state: PollState = {
    steps: 0,
    signature: "",
    lastStepChange: Date.now(),
    lastLog: Date.now(),
    polls: 0,
    questions: 0,
    best: undefined,
  };
  let stop: Watched["stop"] = "terminal";
  let loopCall: string | null = null;
  let snapshot = await core.getAgentRun(runId);
  for (;;) {
    snapshot = await core.getAgentRun(runId);
    await poll(options, state, snapshot);
    if (snapshot.run.state !== "queued" && snapshot.run.state !== "running") break;
    const looping = await loopingCall(core, snapshot);
    if (looping !== undefined) {
      stop = "loop";
      loopCall = looping.slice(0, 500);
      break;
    }
    const reason = stopReason(Date.now(), began, state.lastStepChange, options);
    if (reason !== undefined) {
      stop = reason;
      break;
    }
    await sleep(1_000);
  }
  if (stop !== "terminal") {
    console.log(JSON.stringify({ stage: "killing", case: taskId, reason: stop, loopCall }));
    snapshot = await settle({ core, taskId, runId, jobId });
  }
  return {
    snapshot,
    stop,
    loopCall,
    questions: state.questions,
    status: state.best,
    steps: state.steps,
  };
}
