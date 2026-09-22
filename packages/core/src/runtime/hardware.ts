import { availableParallelism, totalmem } from "node:os";
import { INFERENCE_PROFILE, type InferenceProfile } from "@gardendesk/shared";
import { AGENT_WORKER_LIMITS } from "../agent/limits.js";

const GiB = 1024 * 1024 * 1024;
const MINIMUM_HOST_RESERVE_BYTES = 4 * GiB;

export type InferenceHardwarePolicy =
  | { supported: true; memoryBudgetBytes: number }
  | { supported: false; message: string };

export function resolveInferenceHardwarePolicy(
  _profile: InferenceProfile,
  platform: NodeJS.Platform = process.platform,
  totalMemoryBytes: number = totalmem(),
): InferenceHardwarePolicy {
  if (platform === "win32") {
    return { supported: true, memoryBudgetBytes: INFERENCE_PROFILE.memoryBudgetBytes };
  }
  if (platform !== "darwin") {
    return { supported: false, message: "This operating system is not supported." };
  }
  if (totalMemoryBytes < INFERENCE_PROFILE.minimumMacMemoryBytes) {
    return {
      supported: false,
      message: "Garden Desk requires a Mac with at least 16 GB of memory.",
    };
  }
  return {
    supported: true,
    memoryBudgetBytes:
      totalMemoryBytes < INFERENCE_PROFILE.fullBudgetMacMemoryBytes
        ? INFERENCE_PROFILE.reducedMemoryBudgetBytes
        : INFERENCE_PROFILE.memoryBudgetBytes,
  };
}

export function resolveAgentSessionCapacity(
  inferenceHostMemoryBytes: number,
  totalMemoryBytes: number = totalmem(),
  hostParallelism: number = availableParallelism(),
): number {
  const hostReserveBytes = MINIMUM_HOST_RESERVE_BYTES;
  const guestBudgetBytes = totalMemoryBytes - inferenceHostMemoryBytes - hostReserveBytes;
  const memorySessions = Math.floor(guestBudgetBytes / AGENT_WORKER_LIMITS.memoryBytes);
  const cpuSessions = Math.floor(hostParallelism / AGENT_WORKER_LIMITS.cpuCount);
  return Math.max(0, Math.min(memorySessions, cpuSessions));
}
