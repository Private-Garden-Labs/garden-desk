import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { createGardenDeskCore, type GardenDeskCore } from "@gardendesk/core";
import { type AgentRunSnapshot, DEFAULT_THINKING_LEVEL } from "@gardendesk/shared";
import { prepareAgentModelStore } from "../gates/agent-model-store.js";
import { prepareSpecialistFiles, type SpecialistFiles } from "./specialist-fixtures.js";

const repository = process.cwd();
const selectionTimeoutMs = 2 * 60_000;
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
    id: "folder-intake",
    agentId: "folder-intake",
    toolName: "task",
    files: {
      "invoices.csv": "invoice,amount,currency\nINV-7,120,EUR\n",
      "payment-terms.txt": "Invoices are due 30 days after receipt.\n",
      "receipt.txt": "Receipt INV-7. Amount received: EUR 120.\n",
    },
    request:
      "I will do invoice batch work with this unfamiliar folder. First map the current files by kind and describe their main structures, including the table headers.",
  },
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
    id: "financial-reconciliation",
    agentId: "financial-reconciliation",
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

async function waitForFirstSpecialistAction(
  core: GardenDeskCore,
  runId: string,
  task: SpecialistFirstActionCase,
  startedAt: number,
): Promise<{ elapsedMs: number; snapshot: AgentRunSnapshot }> {
  const deadline = startedAt + selectionTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await core.getAgentRun(runId);
    const action = firstToolAction(snapshot);
    if (action !== undefined) {
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
  throw new Error(`The ${task.id} case did not choose a specialist within two minutes.`);
}

async function waitForTerminal(
  core: GardenDeskCore,
  runId: string,
  deadline: number,
): Promise<void> {
  while (Date.now() < deadline) {
    const snapshot = await core.getAgentRun(runId);
    if (snapshot.run.state !== "queued" && snapshot.run.state !== "running") return;
    await pause(pollIntervalMs);
  }
  throw new Error("The case did not stop within its three-minute limit.");
}

async function run(task: SpecialistFirstActionCase): Promise<void> {
  const root = await mkdtemp(join(repository, `packages/eval/.generated/${task.id}-`));
  const source = join(root, "source");
  await prepareSpecialistFiles(source, task.files);
  const core = await openCore(root);
  let started: { id: string; jobId: string } | undefined;
  const startedAt = Date.now();
  try {
    const folder = await core.addFolder(source);
    const session = await core.createSession(folder.id);
    started = await core.startAgent(session.id, task.request, DEFAULT_THINKING_LEVEL);
    const selected = await waitForFirstSpecialistAction(core, started.id, task, startedAt);
    assert.ok(
      selected.elapsedMs <= selectionTimeoutMs,
      "Specialist selection exceeded two minutes.",
    );
    console.log(
      JSON.stringify({
        case: task.id,
        elapsedMs: selected.elapsedMs,
        firstAction: firstToolAction(selected.snapshot)?.toolName,
        specialist: task.agentId,
      }),
    );
  } finally {
    if (started !== undefined) {
      await core.cancelAgent(started.jobId);
      await waitForTerminal(core, started.id, startedAt + caseTimeoutMs);
    }
    await core.close();
  }
}

assert.ok(
  process.platform === "win32" && process.arch === "x64",
  "This case runner requires Windows x64 and Hyper-V.",
);
const selected = cases.find((item) => item.id === process.argv[2]);
assert.ok(selected, `Select one case: ${cases.map((item) => item.id).join(", ")}`);
await run(selected);
