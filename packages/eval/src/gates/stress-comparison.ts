import { appendFile, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createGardenDeskCore, type GardenDeskCore } from "@gardendesk/core";
import {
  type AgentRunSnapshot,
  DEFAULT_THINKING_LEVEL,
  INFERENCE_PROFILE,
  type ModelRuntimeStatus,
} from "@gardendesk/shared";
import { prepareAgentModelStore } from "./agent-model-store.js";
import { developmentInferenceWorkerEntryPath } from "./development-inference-path.js";
import { type StressTask, stressTasks } from "./stress-comparison-tasks.js";
import { allocatedMemory, visibleSteps, type Watched, watch } from "./stress-comparison-watch.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const repository = process.cwd();
const macos = process.platform === "darwin";
const label = argument("--label") ?? INFERENCE_PROFILE.modelId;
const runtimeDirectory =
  argument("--runtime") ??
  join(
    repository,
    "packages/eval/.generated/inference",
    macos ? "macos-arm64" : "windows-cuda-x64",
  );
const imageRoot = argument("--images") ?? join(repository, "packages/workers/images");
const outputDirectory = join(repository, "packages/eval/.generated/stress-comparison");
const caseLimitMs = Number(argument("--case-timeout") ?? 15 * 60_000);
const stepStallMs = Number(argument("--step-stall") ?? 8 * 60_000);
const selected = argument("--cases")?.split(",");
const suiteFilter = argument("--suite");
const tasks = stressTasks({
  ...(suiteFilter === undefined ? {} : { suite: suiteFilter }),
  ...(selected === undefined ? {} : { ids: selected }),
});

async function openCore(root: string): Promise<GardenDeskCore> {
  const modelStoreDir = join(repository, "packages/eval/.generated/models");
  await prepareAgentModelStore(modelStoreDir);
  const macosHelper = join(
    repository,
    "packages/workers/native/macos-vz-helper/.generated/garden-desk-vz-helper",
  );
  return createGardenDeskCore({
    workspaceDir: join(root, "state"),
    modelStoreDir,
    profile: "auto",
    migrationDirectory: join(repository, "packages/core/src/workspace/migrations"),
    promptDirectory: join(repository, "prompts"),
    workerEntryPath: macos ? developmentInferenceWorkerEntryPath() : "",
    ...(macos
      ? {}
      : {
          inferenceHelperPath: join(
            repository,
            "packages/workers/native/windows-appcontainer-launcher/.generated/garden-desk-appcontainer-launcher.exe",
          ),
        }),
    inferenceRuntimePath: join(runtimeDirectory, macos ? "llama-server" : "llama-server.exe"),
    agentHelperPath: macos
      ? macosHelper
      : join(
          repository,
          "packages/workers/native/windows-hcs-helper/.generated/garden-desk-hcs-helper.exe",
        ),
    agentImageRoot: imageRoot,
  });
}

async function deliverableText(
  core: GardenDeskCore,
  task: StressTask,
  snapshot: AgentRunSnapshot,
): Promise<string> {
  const artifact = snapshot.artifacts.find((item) => item.name === task.deliverable);
  if (artifact === undefined) return "";
  try {
    return await readFile(
      await core.materializeArtifact(snapshot.run.sessionId, artifact.id),
      "utf8",
    );
  } catch {
    return "";
  }
}

interface Totals {
  promptTokens: number;
  outputTokens: number;
  promptSeconds: number;
  outputSeconds: number;
  turns: number;
}

function addPerformance(
  totals: Totals,
  performance: {
    promptTokens: number;
    outputTokens: number;
    tokensPerSecond: number;
    promptTokensPerSecond: number;
  } | null,
): void {
  if (performance === null) return;
  totals.turns += 1;
  totals.promptTokens += performance.promptTokens;
  totals.outputTokens += performance.outputTokens;
  if (performance.promptTokensPerSecond > 0) {
    totals.promptSeconds += performance.promptTokens / performance.promptTokensPerSecond;
  }
  if (performance.tokensPerSecond > 0) {
    totals.outputSeconds += performance.outputTokens / performance.tokensPerSecond;
  }
}

async function collectTotals(
  core: GardenDeskCore,
  snapshot: AgentRunSnapshot,
): Promise<{ totals: Totals; childSteps: number }> {
  const totals: Totals = {
    promptTokens: 0,
    outputTokens: 0,
    promptSeconds: 0,
    outputSeconds: 0,
    turns: 0,
  };
  addPerformance(totals, snapshot.run.performance);
  let childSteps = 0;
  for (const child of snapshot.childRuns) {
    addPerformance(totals, child.performance);
    const childSnapshot = await core.getAgentRun(child.id).catch(() => undefined);
    if (childSnapshot !== undefined) childSteps += visibleSteps(childSnapshot.events);
  }
  return { totals, childSteps };
}

function modelFields(status: ModelRuntimeStatus | undefined): Record<string, unknown> {
  return {
    modelMemoryBytes: status === undefined ? null : allocatedMemory(status),
    modelCpuRamBytes: status?.cpuRamBytes ?? null,
    modelGpuMemoryBytes: status?.gpuMemoryBytes ?? null,
    modelMemoryBudgetBytes: status?.memoryBudgetBytes ?? null,
    modelGpuMemoryKind: status?.gpuMemoryKind ?? null,
    modelContextSizeTokens: status?.contextSizeTokens ?? null,
    modelContextLimitTokens: status?.contextLimitTokens ?? null,
  };
}

function throughput(totals: Totals): Record<string, number | null> {
  return {
    promptTokensPerSecond:
      totals.promptSeconds > 0 ? totals.promptTokens / totals.promptSeconds : null,
    outputTokensPerSecond:
      totals.outputSeconds > 0 ? totals.outputTokens / totals.outputSeconds : null,
  };
}

function resultRow(input: {
  task: StressTask;
  watched: Watched;
  report: string;
  durationMs: number;
  totals: Totals;
  childSteps: number;
}): Record<string, unknown> {
  const { task, watched, report, durationMs, totals, childSteps } = input;
  const snapshot = watched.snapshot;
  const status = watched.status;
  const scores = task.check(report);
  const chosen = snapshot.childRuns.map((child) => child.agentId ?? "");
  const succeeded = snapshot.run.state === "succeeded";
  return {
    label,
    suite: task.suite,
    id: task.id,
    expectedSpecialist: task.agentId,
    chosenSpecialists: chosen,
    specialistCorrect: task.agentId === null ? null : chosen[0] === task.agentId,
    state: snapshot.run.state,
    stop: watched.stop,
    succeeded,
    deliverableFound: report !== "",
    factCoverage: scores.facts,
    sourceCoverage: scores.sources,
    taskSuccess: succeeded && watched.stop === "terminal" && scores.facts === 1,
    steps: watched.steps,
    childSteps,
    totalSteps: watched.steps + childSteps,
    executions: snapshot.executions.length,
    childRuns: snapshot.childRuns.length,
    questionsDismissed: watched.questions,
    durationMs,
    inferenceMs: snapshot.run.performance?.totalDurationMs ?? null,
    promptTokens: totals.promptTokens,
    outputTokens: totals.outputTokens,
    inferenceTurns: totals.turns,
    ...throughput(totals),
    contextUsedTokens: snapshot.contextUsedTokens,
    contextAllocatedTokens: snapshot.contextAllocatedTokens ?? status?.contextSizeTokens ?? null,
    ...modelFields(status),
    error: snapshot.run.error,
    expectation: task.expectation,
    report: report.slice(0, 4_000),
  };
}

async function runTask(task: StressTask): Promise<Record<string, unknown>> {
  const root = await mkdtemp(join(outputDirectory, `${label}-${task.id}-`));
  const source = join(root, "source");
  await mkdir(source, { recursive: true });
  await task.prepare(source);
  const core = await openCore(root);
  const began = Date.now();
  try {
    const folder = await core.addFolder(source);
    await task.afterGrant(source);
    const session = await core.createSession(folder.id);
    const started = await core.startAgent(session.id, task.prompt, DEFAULT_THINKING_LEVEL);
    const watched = await watch({
      core,
      taskId: task.id,
      runId: started.id,
      jobId: started.jobId,
      began,
      caseLimitMs,
      stepStallMs,
    });
    const durationMs = Date.now() - began;
    const report = await deliverableText(core, task, watched.snapshot);
    const { totals, childSteps } = await collectTotals(core, watched.snapshot);
    return resultRow({ task, watched, report, durationMs, totals, childSteps });
  } finally {
    await core.close();
  }
}

await mkdir(outputDirectory, { recursive: true });
const resultsPath = join(outputDirectory, `${label}.jsonl`);
console.log(
  JSON.stringify({
    stage: "plan",
    label,
    model: INFERENCE_PROFILE.modelId,
    runtime: runtimeDirectory,
    tasks: tasks.map((task) => task.id),
    caseLimitMs,
    stepStallMs,
  }),
);
for (const task of tasks) {
  console.log(JSON.stringify({ stage: "starting", case: task.id, suite: task.suite }));
  let row: Record<string, unknown>;
  try {
    row = await runTask(task);
  } catch (error) {
    row = {
      label,
      suite: task.suite,
      id: task.id,
      state: "harness_error",
      stop: "harness_error",
      succeeded: false,
      taskSuccess: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  await appendFile(resultsPath, `${JSON.stringify(row)}\n`);
  console.log(JSON.stringify({ stage: "scored", ...row, report: undefined }));
}
console.log(JSON.stringify({ stage: "finished", label, resultsPath }));
