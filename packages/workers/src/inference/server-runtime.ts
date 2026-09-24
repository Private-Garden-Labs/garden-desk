import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { INFERENCE_PROFILE, SPLASH_MODEL } from "@gardendesk/shared";
import type { NativeWorkerHandle, NativeWorkerLauncher } from "../native/launcher.js";
import { ServerError, serverFailure, serverRequest } from "./server-http.js";
import { observeServerMemory, type ServerAllocations } from "./server-memory.js";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: keep the fixed runtime arguments together.
export function serverArguments(input: {
  backend: "metal" | "cuda" | "hip";
  modelPath: string;
  contextTokens: number;
  embedding?: boolean;
  projectorPath?: string;
  speculation: "none" | "ngram-mod";
}): string[] {
  const device = { metal: "MTL0", cuda: "CUDA0", hip: "ROCm0" }[input.backend];
  return [
    "--model",
    input.modelPath,
    "--offline",
    "--no-ui",
    "--no-ui-mcp-proxy",
    "--jinja",
    "--fit",
    "off",
    "--gpu-layers",
    "all",
    "--override-tensor",
    `.*=${device}`,
    "--split-mode",
    "none",
    "--main-gpu",
    "0",
    "--flash-attn",
    "on",
    "--ctx-size",
    String(input.contextTokens),
    "--parallel",
    "1",
    "--no-context-shift",
    "--slots",
    "--batch-size",
    String(input.embedding ? input.contextTokens : 512),
    "--ubatch-size",
    String(input.embedding ? input.contextTokens : 256),
    "--cache-type-k",
    "f16",
    "--cache-type-v",
    "f16",
    "--ctx-checkpoints",
    "2",
    "--checkpoint-min-step",
    "0",
    "--cache-ram",
    "0",
    "--log-verbosity",
    "4",
    "--spec-type",
    input.speculation,
    ...(input.embedding
      ? ["--embedding", "--pooling", "last"]
      : ["--reasoning-budget", String(INFERENCE_PROFILE.reasoningBudgetTokens)]),
    ...(input.projectorPath === undefined
      ? []
      : [
          "--mmproj",
          input.projectorPath,
          "--image-max-tokens",
          String(INFERENCE_PROFILE.imageTokens),
        ]),
  ];
}

function splashArguments(modelPath: string, contextTokens: number | "auto"): string[] {
  return [
    join(modelPath, "target"),
    join(modelPath, "draft"),
    "--tokenizer",
    join(modelPath, "tokenizer"),
    "--model",
    SPLASH_MODEL.repository,
    "--max-context",
    String(contextTokens),
    "--max-memory",
    "auto",
  ];
}

export type ServerHandle = NativeWorkerHandle & {
  memory(): ServerAllocations;
  splash: boolean;
  contextTokens: number;
};

type ServerInput = {
  modelPath: string;
  memoryBudgetBytes: number;
  /** "auto" lets Splash fit the context; llama.cpp always receives a number. */
  contextTokens: number | "auto";
  embedding?: boolean;
  projectorPath?: string;
  speculation: "none" | "ngram-mod";
};

function launchArguments(launcher: NativeWorkerLauncher, input: ServerInput) {
  const splash = launcher.splash === true && input.embedding !== true;
  const { contextTokens } = input;
  if (splash) return { splash, serverArguments: splashArguments(input.modelPath, contextTokens) };
  if (contextTokens === "auto") throw new ServerError("invalid_argument");
  const backend = launcher.gpu?.backend ?? "metal";
  return { splash, serverArguments: serverArguments({ ...input, contextTokens, backend }) };
}

async function servedContextTokens(
  handle: NativeWorkerHandle,
  input: ServerInput,
  splash: boolean,
  signal: AbortSignal,
): Promise<number> {
  if (!splash) return Number(input.contextTokens);
  const status = (await serverRequest(handle, "/status", undefined, { signal })) as {
    maximum_context_tokens: number;
  };
  return Math.min(status.maximum_context_tokens, INFERENCE_PROFILE.maximumContextTokens);
}

export async function startServer(
  launcher: NativeWorkerLauncher,
  entryPath: string,
  input: ServerInput,
  signal: AbortSignal,
): Promise<ServerHandle> {
  const launch = launchArguments(launcher, input);
  const handle = await launcher.launch({
    workerEntryPath: entryPath,
    memoryBudgetBytes: input.memoryBudgetBytes,
    readPaths: [
      input.modelPath,
      ...(input.projectorPath === undefined ? [] : [input.projectorPath]),
    ],
    ...launch,
  });
  const memory = observeServerMemory(handle);
  let ready = false;
  let stopped = false;
  let failure = new ServerError("worker_crash");
  let pending = "";
  const output = (chunk: Buffer) => {
    pending = (pending + chunk.toString()).slice(-65_536);
    ready ||= pending.includes("listening on unix://");
    failure = serverFailure(pending);
    if (ready) pending = "";
  };
  handle.process.stdout.on("data", output);
  handle.process.stderr.on("data", output);
  handle.process.once("error", () => {
    stopped = true;
  });
  handle.process.once("close", () => {
    stopped = true;
  });
  try {
    while (!ready) {
      signal.throwIfAborted();
      if (stopped) throw failure;
      await delay(25, undefined, { signal });
    }
    await serverRequest(handle, "/health", undefined, { signal });
    const contextTokens = await servedContextTokens(handle, input, launch.splash, signal);
    return Object.assign(handle, { memory, splash: launch.splash, contextTokens });
  } catch (error) {
    await handle.dispose();
    throw error;
  } finally {
    pending = "";
    handle.process.stdout.off("data", output);
    handle.process.stderr.off("data", output);
    handle.process.stdout.resume();
    handle.process.stderr.resume();
  }
}
