import { describe, expect, it } from "vitest";
import { resolveAgentSessionCapacity, resolveInferenceHardwarePolicy } from "./hardware.js";

const GiB = 1024 * 1024 * 1024;

describe("automatic inference hardware policy", () => {
  it.each([
    [48, 16],
    [32, 16],
    [24, 16],
    [16, 10],
  ])("uses a %d GiB Mac with a %d GiB model and context budget", (memory, budget) => {
    expect(resolveInferenceHardwarePolicy("auto", "darwin", memory * GiB)).toEqual({
      supported: true,
      memoryBudgetBytes: budget * GiB,
    });
  });

  it("rejects an 8 GiB Mac before inference starts", () => {
    expect(resolveInferenceHardwarePolicy("auto", "darwin", 8 * GiB)).toEqual({
      supported: false,
      message: "Garden Desk requires a Mac with at least 16 GB of memory.",
    });
  });

  it("uses system memory only as the Windows worker process bound", () => {
    expect(resolveInferenceHardwarePolicy("auto", "win32", 64 * GiB)).toEqual({
      supported: true,
      memoryBudgetBytes: 16 * GiB,
    });
  });

  it("checks hardware before an explicit profile", () => {
    expect(resolveInferenceHardwarePolicy("local16", "darwin", 48 * GiB)).toEqual({
      supported: true,
      memoryBudgetBytes: 16 * GiB,
    });
    expect(resolveInferenceHardwarePolicy("local16", "darwin", 12 * GiB).supported).toBe(false);
    expect(resolveInferenceHardwarePolicy("local16", "win32", 64 * GiB)).toEqual({
      supported: true,
      memoryBudgetBytes: 16 * GiB,
    });
  });
});

describe("agent VM memory policy", () => {
  it.each([
    [16, 10, 2],
    [24, 16, 4],
    [32, 16, 12],
    [48, 16, 28],
  ])("allows %d GiB Macs %d GiB inference and %d agent VMs", (memory, inference, sessions) => {
    expect(resolveAgentSessionCapacity(inference * GiB, memory * GiB, 256)).toBe(sessions);
  });

  it.each([
    [32, 8],
    [64, 40],
    [128, 104],
  ])("reserves 20 GiB for inference on a %d GiB Windows host", (memory, sessions) => {
    expect(resolveAgentSessionCapacity(20 * GiB, memory * GiB, 512)).toBe(sessions);
  });

  it("keeps concurrent guests inside the host processors", () => {
    expect(resolveAgentSessionCapacity(16 * GiB, 128 * GiB, 8)).toBe(2);
  });
});
