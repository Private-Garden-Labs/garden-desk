import type { GardenDeskCore } from "@gardendesk/core";
import type { AgentRunSnapshot } from "@gardendesk/shared";
import { expect, it } from "vitest";
import { watch } from "./stress-comparison-watch.js";

it("does not stop a case while its child keeps adding steps", async () => {
  let mainPolls = 0;
  let childEvents = 0;
  const child = { id: "child", state: "running", updatedAt: "2026-09-26T00:00:00.000Z" };
  const snapshot = (state: string, events: unknown[], childRuns: unknown[]) =>
    ({
      run: { state },
      events,
      executions: [],
      contextUsedTokens: 100,
      childRuns,
      question: null,
    }) as unknown as AgentRunSnapshot;
  const core = {
    async getAgentRun(id: string) {
      if (id === "child") {
        childEvents += 1;
        return snapshot(
          "running",
          Array.from({ length: childEvents }, () => ({ type: "tool.completed", toolCallId: null })),
          [],
        );
      }
      mainPolls += 1;
      return snapshot(mainPolls > 5 ? "succeeded" : "running", [], mainPolls > 5 ? [] : [child]);
    },
    async modelStatus() {
      throw new Error("unavailable");
    },
    async cancelAgent() {
      return true;
    },
  } as unknown as GardenDeskCore;
  const watched = await watch({
    core,
    taskId: "case",
    runId: "main",
    jobId: "job",
    began: Date.now(),
    caseLimitMs: 60_000,
    stepStallMs: 1_500,
  });
  expect(watched.stop).toBe("terminal");
}, 20_000);
