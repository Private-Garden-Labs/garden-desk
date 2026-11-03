import { describe, expect, it } from "vitest";
import { debugSnapshotReducer, initialDebugSnapshotState } from "./debug-snapshot.js";

describe("debug snapshot state", () => {
  it("clears stale paths while creating and after failures", () => {
    const ready = debugSnapshotReducer(initialDebugSnapshotState, {
      type: "create.succeeded",
      path: "/tmp/garden-desk-session-debug-ready",
    });
    expect(debugSnapshotReducer(ready, { type: "create.start" })).toEqual({
      creating: true,
      error: undefined,
      path: undefined,
      revealing: false,
    });
    const failed = debugSnapshotReducer(ready, {
      type: "create.failed",
      code: "debug_state_invalid",
    });
    expect(failed.path).toBeUndefined();
    expect(failed.error).toBe("Could not save the debug snapshot. Code: debug_state_invalid");
  });

  it("retains the created path across reveal failures and resets for another session", () => {
    const ready = debugSnapshotReducer(initialDebugSnapshotState, {
      type: "create.succeeded",
      path: "/tmp/garden-desk-session-debug-ready",
    });
    const failure = debugSnapshotReducer(ready, {
      type: "reveal.failed",
      code: "debug_snapshot_missing",
    });
    expect(failure.path).toBe(ready.path);
    expect(failure.error).toContain("Code: debug_snapshot_missing");
    expect(debugSnapshotReducer(failure, { type: "session.reset" })).toBe(
      initialDebugSnapshotState,
    );
  });
});
