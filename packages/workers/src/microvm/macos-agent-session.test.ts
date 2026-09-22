import { randomUUID } from "node:crypto";
import { AgentExecutionIdSchema } from "@gardendesk/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeFrame } from "../ipc.js";
import { AgentHelperTransport } from "./agent-transport.js";
import { FramedAgentSession } from "./macos-agent-session.js";
import { executeRequest, fakeChild, resultFrame } from "./macos-agent-session-test-support.js";
import type { AgentWorkspaceStore } from "./workspace-store.js";

describe("agent session guest response deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails the execution when the guest never answers", async () => {
    vi.useFakeTimers();
    const { child } = fakeChild();
    const session = new FramedAgentSession({
      sessionId: randomUUID(),
      limits: {
        wallTimeMs: 1_000,
        memoryBytes: 1024 * 1024 * 1024,
        scratchBytes: 128 * 1024 * 1024,
        outputBytes: 1_000_000,
      },
      transport: new AgentHelperTransport(child),
      store: {} as AgentWorkspaceStore,
      temporaryRoot: "/unused",
      lifecyclePlatform: "macos",
    });
    const execution = session.execute({
      language: "python",
      path: "steps/live.py",
      source: "print('live')",
    });
    const failure = expect(execution).rejects.toThrow("agent_guest_unresponsive");
    await vi.advanceTimersByTimeAsync(17_000);
    await failure;
  });
});

describe("agent helper ordered live stream", () => {
  it("delivers ordered bounded frames before the terminal result", async () => {
    const { child, stdout } = fakeChild();
    const transport = new AgentHelperTransport(child);
    const requestId = randomUUID();
    const executionId = AgentExecutionIdSchema.parse(randomUUID());
    const updates: string[] = [];
    const result = transport.exchange(executeRequest(requestId, executionId), undefined, {
      executionId,
      onUpdate(update) {
        updates.push(
          update.kind === "stream" ? Buffer.from(update.bytes).toString("utf8") : update.code,
        );
      },
    });
    stdout.write(
      encodeFrame({
        protocolVersion: 3,
        requestId,
        executionId,
        operation: "diagnostic",
        sequence: 0,
        diagnostic: { code: "process_start", platform: "guest", platformCode: null },
      }),
    );
    stdout.write(
      encodeFrame({
        protocolVersion: 3,
        requestId,
        executionId,
        operation: "stream",
        sequence: 1,
        stream: "stdout",
        contentBase64: Buffer.from("live\n").toString("base64"),
        byteLength: 5,
      }),
    );
    stdout.write(encodeFrame(resultFrame(requestId, executionId)));

    await expect(result).resolves.toMatchObject({ operation: "execute", executionId });
    expect(updates).toEqual(["process_start", "live\n"]);
  });
});
describe("agent helper stream validation", () => {
  it("rejects out-of-order and oversized stream frames", async () => {
    const { child, stdout } = fakeChild();
    const transport = new AgentHelperTransport(child);
    const requestId = randomUUID();
    const executionId = AgentExecutionIdSchema.parse(randomUUID());
    const result = transport.exchange(executeRequest(requestId, executionId), undefined, {
      executionId,
      onUpdate() {},
    });
    stdout.write(
      encodeFrame({
        protocolVersion: 3,
        requestId,
        executionId,
        operation: "stream",
        sequence: 1,
        stream: "stdout",
        contentBase64: "YQ==",
        byteLength: 1,
      }),
    );
    await expect(result).rejects.toThrow("agent_helper_stream_order_invalid");
    expect(() =>
      encodeFrame({
        protocolVersion: 3,
        requestId,
        executionId,
        operation: "stream",
        sequence: 0,
        stream: "stdout",
        contentBase64: "YQ==",
        byteLength: 64 * 1024 + 1,
      }),
    ).toThrow();
  });
});

describe("agent helper error privacy", () => {
  it("does not surface raw helper stderr", async () => {
    const { child, stderr } = fakeChild();
    const transport = new AgentHelperTransport(child);
    const requestId = randomUUID();
    const executionId = AgentExecutionIdSchema.parse(randomUUID());
    const result = transport.exchange(executeRequest(requestId, executionId));
    stderr.write("/private/tmp/customer-path secret");
    child.emit("close", 1, null);

    await expect(result).rejects.toThrow("agent_helper_exited_1");
    await expect(result).rejects.not.toThrow("customer-path");
  });
});
