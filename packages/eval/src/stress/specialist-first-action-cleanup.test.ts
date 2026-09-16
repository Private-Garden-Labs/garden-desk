import { describe, expect, it } from "vitest";
import {
  closeFirstActionCase,
  type FirstActionRunCore,
} from "./specialist-first-action-cleanup.js";

describe("specialist first-action cleanup", () => {
  it("closes Core when the terminal wait reaches its deadline", async () => {
    let closeCount = 0;
    const core: FirstActionRunCore = {
      cancelAgent: async () => true,
      getAgentRun: async () => ({ run: { state: "running" } }),
      close: async () => {
        closeCount += 1;
      },
    };

    await expect(
      closeFirstActionCase(core, { id: "run", jobId: "job" }, Date.now() - 1),
    ).rejects.toThrow("The case did not stop within its three-minute limit.");
    expect(closeCount).toBe(1);
  });
});
