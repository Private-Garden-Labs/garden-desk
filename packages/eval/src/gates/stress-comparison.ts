import {
  appendFile,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { createGardenDeskCore, type GardenDeskCore } from "@gardendesk/core";
import {
  type AgentRunSnapshot,
  DEFAULT_THINKING_LEVEL,
  INFERENCE_PROFILE,
  type ModelRuntimeStatus,
  ThinkingLevelSchema,
} from "@gardendesk/shared";
import { prepareAgentModelStore } from "./agent-model-store.js";
import { developmentInferenceWorkerEntryPath } from "./development-inference-path.js";
import { type Deliverable, type StressTask, stressTasks } from "./stress-comparison-tasks.js";
import {
  allocatedMemory,
  deliverableBytes,
  loadedSkills,
  visibleSteps,
  type Watched,
  watch,
} from "./stress-comparison-watch.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const repository = process.cwd();
const macos = process.platform === "darwin";
const developmentModel = argument("--development-model");
const developmentSettings = argument("--development-settings");
const label =
  argument("--label") ?? developmentModel?.replace("/", "-") ?? INFERENCE_PROFILE.modelId;
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
const withoutSpecialists = process.argv.includes("--without-specialists");
const withoutReview = process.argv.includes("--without-review");
const plainPrompts = process.argv.includes("--plain");
const thinking = ThinkingLevelSchema.parse(argument("--thinking") ?? DEFAULT_THINKING_LEVEL);
const tasks = stressTasks({
  ...(suiteFilter === undefined ? {} : { suite: suiteFilter }),
  ...(selected === undefined ? {} : { ids: selected }),
});

/** With --without-specialists or --without-review, Core loads a prompt copy without those workflows. */
async function preparePrompts(): Promise<string> {
  const source = join(repository, "prompts");
  if (!withoutSpecialists && !withoutReview) return source;
  const copy = join(outputDirectory, `${label}-prompts`);
  await rm(copy, { recursive: true, force: true });
  await cp(source, copy, { recursive: true });
  if (withoutSpecialists) {
    for (const name of [
      "matter-chronology",
      "contract-obligations",
      "document-comparison",
      "financial-review",
    ])
      await rm(join(copy, "agents", `${name}.md`));
    for (const name of ["obligations", "reconcile", "expenses"])
      await rm(join(copy, "commands", `${name}.md`));
  }
  if (withoutReview) await removeReview(copy);
  return copy;
}

async function removeReview(copy: string): Promise<void> {
  await rm(join(copy, "commands", "review.md"));
  const primary = join(copy, "agents", "primary.md");
  const text = await readFile(primary, "utf8");
  if (!text.includes(", review]") || !/^1\. `review`:.*$/mu.test(text))
    throw new Error("review_route_missing");
  await writeFile(primary, text.replace(", review]", "]").replace(/^1\. `review`:.*\r?\n/mu, ""));
}

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
    promptDirectory,
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
): Promise<{ totals: Totals; childSteps: number; skills: string[] }> {
  const totals: Totals = {
    promptTokens: 0,
    outputTokens: 0,
    promptSeconds: 0,
    outputSeconds: 0,
    turns: 0,
  };
  addPerformance(totals, snapshot.run.performance);
  let childSteps = 0;
  const skills = loadedSkills(snapshot.events);
  for (const child of snapshot.childRuns) {
    addPerformance(totals, child.performance);
    const childSnapshot = await core.getAgentRun(child.id).catch(() => undefined);
    if (childSnapshot === undefined) continue;
    childSteps += visibleSteps(childSnapshot.events);
    skills.push(...loadedSkills(childSnapshot.events));
  }
  return { totals, childSteps, skills };
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
  output: Deliverable;
  durationMs: number;
  totals: Totals;
  childSteps: number;
}): Record<string, unknown> {
  const { task, watched, output, durationMs, totals, childSteps } = input;
  const snapshot = watched.snapshot;
  const status = watched.status;
  const scores = task.check(output);
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
    loopCall: watched.loopCall,
    succeeded,
    deliverableFound: output.bytes.length > 0,
    skills: output.skills,
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
    report: (scores.note ?? output.text).slice(0, 4_000),
  };
}

/** The final chat response followed by every text file that the run saved. */
async function responseBytes(core: GardenDeskCore, snapshot: AgentRunSnapshot): Promise<Buffer> {
  const parts = [snapshot.run.response ?? ""];
  for (const artifact of snapshot.artifacts.filter((item) => /\.(md|txt|csv)$/iu.test(item.name)))
    parts.push(
      await core
        .materializeArtifact(snapshot.run.sessionId, artifact.id)
        .then((path) => readFile(path, "utf8"))
        .catch(() => ""),
    );
  return Buffer.from(parts.join("\n"));
}

async function runTask(task: StressTask): Promise<Record<string, unknown>> {
  const root = await mkdtemp(join(outputDirectory, `${label}-${task.id}-`));
  const source = join(root, "source");
  await mkdir(source, { recursive: true });
  await task.prepare(source);
  const core = await openCore(root);
  const settingsCopy = join(root, "state", ".garden-desk", "dev-openrouter.json");
  if (developmentSettings !== undefined) {
    await mkdir(join(root, "state", ".garden-desk"), { recursive: true });
    await copyFile(developmentSettings, settingsCopy);
  }
  const began = Date.now();
  try {
    const attachments = task.attachments ?? [];
    const folder = attachments.length === 0 ? await core.addFolder(source) : undefined;
    await task.afterGrant(source);
    const session = await core.createSession(folder?.id ?? null);
    for (const name of attachments) await core.addAttachment(session.id, join(source, name));
    const prompt =
      task.command === undefined || plainPrompts ? task.prompt : `/${task.command} ${task.prompt}`;
    const started = await core.startAgent(session.id, prompt, thinking, developmentModel);
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
    const bytes =
      task.deliverable === "response"
        ? await responseBytes(core, watched.snapshot)
        : await deliverableBytes(core, task.deliverable, watched.snapshot);
    const { totals, childSteps, skills } = await collectTotals(core, watched.snapshot);
    const output = { bytes, text: bytes.toString("utf8"), skills };
    return resultRow({ task, watched, output, durationMs, totals, childSteps });
  } finally {
    await core.close();
    await rm(settingsCopy, { force: true });
  }
}

await mkdir(outputDirectory, { recursive: true });
const promptDirectory = await preparePrompts();
const resultsPath = join(outputDirectory, `${label}.jsonl`);
console.log(
  JSON.stringify({
    stage: "plan",
    label,
    model: developmentModel ?? INFERENCE_PROFILE.modelId,
    runtime: runtimeDirectory,
    withoutSpecialists,
    withoutReview,
    plainPrompts,
    thinking,
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
