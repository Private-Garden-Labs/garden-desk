import { randomUUID } from "node:crypto";
import { reviewDocument } from "../commands/document-review.js";
import type { CommandInvocation } from "../commands/library.js";
import type { InferenceService } from "../runtime/inference.js";
import { AgentExecutionAttemptError } from "./agent-executor.js";
import type { ChatAgentInput } from "./chat-loop-input.js";
import type { ToolExecutionResult } from "./generic-tool-support.js";

export async function runInternalReview(
  command: CommandInvocation,
  input: ChatAgentInput,
  chat: InferenceService["chat"],
  path: string,
): Promise<ToolExecutionResult> {
  const directory = `.garden-desk-tools/review-${randomUUID()}`;
  const output: ToolExecutionResult = { content: "", failed: false, guestExecutionsStarted: 0 };
  try {
    const result = await reviewDocument(
      command,
      {
        agent: input.agent,
        contextTokens: input.contextTokens,
        modelId: input.modelId,
        skills: input.skills,
        systemPrompt: input.systemPrompt,
        task: command.arguments,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        ...(input.trace === undefined ? {} : { trace: input.trace }),
        executor: {
          async execute(request, signal) {
            output.execution = await input.executor.execute(request, signal, () => {
              output.guestExecutionsStarted = 1;
            });
            output.guestExecutionsStarted = 1;
            return output.execution;
          },
        },
      },
      chat,
      { attachment: { path, displayName: path }, directory },
    );
    output.content = JSON.stringify({
      source: path,
      extractedTextPath: `/workspace/${directory}/review-extracted.txt`,
      findings: result.response,
    });
  } catch (error) {
    input.signal?.throwIfAborted();
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    output.failed = true;
    output.content = error instanceof Error ? error.message : String(error);
    if (error instanceof AgentExecutionAttemptError) output.executionAttempt = error.attempt;
  }
  return output;
}
