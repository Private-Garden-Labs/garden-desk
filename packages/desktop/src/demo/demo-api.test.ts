import { describe, expect, it } from "vitest";
import { DemoDesktopApi } from "./demo-api.js";
import { REVIEW_DURATION_MS } from "./review-run.js";

describe("scripted document review demo", () => {
  it("finishes the review with the three-mistake report as the assistant message", async () => {
    let now = 1_000;
    const api = new DemoDesktopApi(() => now);
    const session = await api.createSession(null);
    const run = await api.startAgent(session.id, "Review this document", "medium");
    now += 5_000;
    expect((await api.getAgentRun(run.id)).run.state).toBe("running");
    now += REVIEW_DURATION_MS;
    const finished = await api.getAgentRun(run.id);
    expect(finished.run.state).toBe("succeeded");
    expect((await api.listMessages(session.id)).at(-1)?.content).toContain("**3 mistakes**");
  });
});
