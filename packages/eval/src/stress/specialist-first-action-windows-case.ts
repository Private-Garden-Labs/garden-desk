import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createGardenDeskCore, type GardenDeskCore } from "@gardendesk/core";
import { type AgentRunSnapshot, DEFAULT_THINKING_LEVEL } from "@gardendesk/shared";
import { prepareAgentModelStore } from "../gates/agent-model-store.js";
import { closeFirstActionCase } from "./specialist-first-action-cleanup.js";
import { prepareSpecialistFiles, type SpecialistFiles } from "./specialist-fixtures.js";

const repository = process.cwd();
const selectionTimeoutMs = 60_000;
const caseTimeoutMs = 3 * 60_000;
const pollIntervalMs = 250;
const inferenceWorker = join(
  repository,
  "packages/eval/.generated/specialist-first-action-inference/worker.mjs",
);

interface SpecialistFirstActionCase {
  id: string;
  agentId: string;
  files: SpecialistFiles;
  request: string;
  toolName: "review" | "task";
}

const cases: SpecialistFirstActionCase[] = [
  {
    id: "contract-obligations",
    agentId: "contract-obligations",
    toolName: "task",
    files: {
      "services-agreement.txt":
        "Services agreement\nSupplier provides monthly maintenance.\nCustomer pays EUR 1200 each month.\nInvoices are due within 30 days of receipt.\nEither party gives 45 days notice before non-renewal.\n",
    },
    request:
      "Identify the duties, monthly fee, payment period, and non-renewal notice in /source/services-agreement.txt. Cite the source.",
  },
  {
    id: "financial-review",
    agentId: "financial-review",
    toolName: "task",
    files: {
      "invoices.csv": "invoice,amount,currency\nA,100,EUR\nB,200,EUR\nC,50,EUR\n",
      "payments.csv": "invoice,amount,currency\nA,100,EUR\nB,150,EUR\n",
    },
    request:
      "Reconcile /source/invoices.csv against /source/payments.csv by invoice ID and currency. Identify full, partial, and unpaid items with source references.",
  },
  {
    id: "document-review",
    agentId: "document-review",
    toolName: "review",
    files: {
      "board-notes.txt":
        "Board notes\nProject Cedar budget: EUR 5000.\nProject Cedar spend: EUR 3200.\nProject Cedar budget: EUR 4500.\nApproval date: 2026-09-30.\nApproval date: 2026-10-15.\n",
    },
    request:
      "Review /source/board-notes.txt for internal inconsistencies. Cite each conflicting line.",
  },
  {
    id: "document-review-docx",
    agentId: "document-review",
    toolName: "review",
    files: {
      "services-agreement.docx":
        "Services agreement\nSupplier: Cedar Ltd.\nCustomer pays EUR 1200 each month.\nCustomer pays EUR 1250 each month.\nSupplier: Cedar Limited.\n",
    },
    request: "Review this doc: /source/services-agreement.docx",
  },
];

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openCore(root: string): Promise<GardenDeskCore> {
  const modelStoreDir = join(repository, "packages/eval/.generated/models");
  await prepareAgentModelStore(modelStoreDir);
  return createGardenDeskCore({
    workspaceDir: join(root, "state"),
    modelStoreDir,
    profile: "auto",
    migrationDirectory: join(repository, "packages/core/src/workspace/migrations"),
    promptDirectory: join(repository, "prompts"),
    workerEntryPath: inferenceWorker,
    inferenceHelperPath: join(
      repository,
      "packages/workers/native/windows-appcontainer-launcher/.generated/garden-desk-appcontainer-launcher.exe",
    ),
    inferenceRuntimePath: join(
      repository,
      "packages/eval/.generated/inference/windows-cuda-x64/llama-server.exe",
    ),
    agentHelperPath: join(
      repository,
      "packages/workers/native/windows-hcs-helper/.generated/garden-desk-hcs-helper.exe",
    ),
    agentImageRoot: join(repository, "packages/workers/images"),
  });
}

function firstToolAction(snapshot: AgentRunSnapshot) {
  return snapshot.events.find((event) => event.type === "tool.started");
}

function timing(snapshot: AgentRunSnapshot, startedAt: number) {
  const inference = snapshot.events.find((event) => event.type === "inference.started");
  const action = firstToolAction(snapshot);
  const at = (event: { createdAt: string } | undefined) =>
    event === undefined ? undefined : Date.parse(event.createdAt) - startedAt;
  return {
    modelReadyMs: at(inference),
    inferenceStep: inference?.summary,
    thinkingMs: inference?.durationMs ?? null,
    selectionMs:
      inference === undefined || action === undefined
        ? undefined
        : Date.parse(action.createdAt) - Date.parse(inference.createdAt),
  };
}

function thinkingRecorder(task: SpecialistFirstActionCase) {
  let thinking = "";
  return {
    observe(snapshot: AgentRunSnapshot) {
      if (snapshot.thinking) thinking = snapshot.thinking;
    },
    save: () =>
      writeFile(
        join(repository, `packages/eval/.generated/first-action-${task.id}-thinking.txt`),
        thinking,
      ),
  };
}

async function waitForFirstSpecialistAction(
  core: GardenDeskCore,
  runId: string,
  task: SpecialistFirstActionCase,
  startedAt: number,
): Promise<{ elapsedMs: number; snapshot: AgentRunSnapshot }> {
  const deadline = startedAt + selectionTimeoutMs;
  const recorder = thinkingRecorder(task);
  while (Date.now() < deadline) {
    const snapshot = await core.getAgentRun(runId);
    recorder.observe(snapshot);
    const action = firstToolAction(snapshot);
    if (action !== undefined) {
      await recorder.save();
      assert.equal(action.toolName, task.toolName, `First action for ${task.id} is incorrect.`);
      const child = snapshot.childRuns.find((item) => item.parentToolCallId === action.toolCallId);
      if (child !== undefined) {
        assert.equal(child.agentId, task.agentId, `Specialist for ${task.id} is incorrect.`);
        return { elapsedMs: Date.now() - startedAt, snapshot };
      }
    }
    if (snapshot.run.state !== "queued" && snapshot.run.state !== "running") {
      throw new Error(
        snapshot.run.error ?? `The ${task.id} case ended before a specialist action.`,
      );
    }
    await pause(pollIntervalMs);
  }
  throw new Error(`The ${task.id} case did not choose a specialist within one minute.`);
}

async function warmModel(core: GardenDeskCore, folderId: string): Promise<void> {
  const session = await core.createSession(folderId);
  const started = await core.startAgent(session.id, "Reply with only the word ready.", "none");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const snapshot = await core.getAgentRun(started.id);
    if (snapshot.run.state !== "queued" && snapshot.run.state !== "running") return;
    await pause(pollIntervalMs);
  }
  throw new Error("The warm-up run did not finish within two minutes.");
}

async function run(task: SpecialistFirstActionCase): Promise<void> {
  const root = await mkdtemp(join(repository, `packages/eval/.generated/${task.id}-`));
  const source = join(root, "source");
  await prepareSpecialistFiles(source, task.files);
  const core = await openCore(root);
  let started: { id: string; jobId: string } | undefined;
  let startedAt = Date.now();
  try {
    const folder = await core.addFolder(source);
    await warmModel(core, folder.id);
    const session = await core.createSession(folder.id);
    startedAt = Date.now();
    started = await core.startAgent(session.id, task.request, DEFAULT_THINKING_LEVEL);
    const selected = await waitForFirstSpecialistAction(core, started.id, task, startedAt);
    console.log(
      JSON.stringify({
        case: task.id,
        elapsedMs: selected.elapsedMs,
        ...timing(selected.snapshot, startedAt),
        firstAction: firstToolAction(selected.snapshot)?.toolName,
        specialist: task.agentId,
      }),
    );
  } finally {
    await closeFirstActionCase(core, started, startedAt + caseTimeoutMs);
  }
}

assert.ok(
  process.platform === "win32" && process.arch === "x64",
  "This case runner requires Windows x64 and Hyper-V.",
);
const selected = cases.find((item) => item.id === process.argv[2]);
assert.ok(selected, `Select one case: ${cases.map((item) => item.id).join(", ")}`);
await run(selected);
