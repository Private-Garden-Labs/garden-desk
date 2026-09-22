import type { ChatGenerationResult } from "@gardendesk/shared";
import { afterEach, describe, expect, it } from "vitest";
import type { ChatInput } from "../runtime/inference.js";
import {
  chatResult,
  cleanServiceFixtures,
  fixture,
  outputExecution,
  terminal,
} from "./service-test-support.js";

function interruptedInference() {
  const inputs: ChatInput[] = [];
  let secondTurnStarted: () => void = () => undefined;
  const secondTurn = new Promise<void>((resolve) => {
    secondTurnStarted = resolve;
  });
  const inference = {
    async chat(input: ChatInput, signal?: AbortSignal): Promise<ChatGenerationResult> {
      inputs.push(input);
      if (inputs.length === 1)
        return chatResult("", [
          { id: "call-draft", name: "python", params: { source: "print('draft')" } },
        ]);
      if (inputs.length === 3) return chatResult("Done.", []);
      signal?.throwIfAborted();
      secondTurnStarted();
      return await new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  };
  return { inference, inputs, secondTurn };
}

afterEach(cleanServiceFixtures);

describe("persisted chat agent continuation", () => {
  it("gives the next run a record of the cancelled work", async () => {
    const { inference, inputs, secondTurn } = interruptedInference();
    const { catalog, conversations, service } = await fixture(inference, async (request) =>
      outputExecution(request, "draft"),
    );
    const sessionId = conversations.createSession(null).id;
    const first = service.start(sessionId, "Write the story");
    await secondTurn;
    expect(service.cancel(first.jobId)).toBe(true);
    await terminal(service, first.id);

    const second = service.start(sessionId, "Continue");
    await terminal(service, second.id);

    const history = inputs[2]?.messages
      .slice(1)
      .map((message) => [message.role, "text" in message ? message.text : ""]);
    expect(history).toEqual([
      ["user", "Write the story"],
      ["assistant", expect.stringContaining("Task cancelled.")],
      ["user", "Continue"],
    ]);
    expect(history?.[1]?.[1]).toContain("Ran code.");
    await service.close();
    catalog.close();
  });
});
