import type { AgentRunSummary } from "@gardendesk/shared";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "./state-types.js";
import { withGuestStart } from "./timeline.js";

function activity(
  id: string,
  createdAt: string,
  eventType: "tool.started" | "tool.completed",
): TimelineItem {
  return { createdAt, eventType, id, kind: "activity", runId: "run-1", text: id, toolCallId: "c1" };
}

describe("withGuestStart", () => {
  it("places a microVM start that happens inside a tool call before that tool call", () => {
    const run = { id: "run-1", createdAt: "2026-09-22T21:33:54.181Z" } as AgentRunSummary;
    const items = [
      activity("tool-start", "2026-09-22T21:35:09.655Z", "tool.started"),
      activity("tool-end", "2026-09-22T21:35:10.517Z", "tool.completed"),
    ];
    const start = { startedAt: "2026-09-22T21:35:09.700Z", durationMs: 500, failed: false };

    const ids = withGuestStart(items, run, start).map((item) => item.id);

    expect(ids).toEqual(["guest-start-run-1", "tool-start", "tool-end"]);
  });
});
