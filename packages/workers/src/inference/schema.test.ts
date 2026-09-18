import {
  type ChatGenerationRequest,
  ChatGenerationRequestSchema,
  StructuredGenerationRequestSchema,
} from "@gardendesk/shared";
import { describe, expect, it } from "vitest";
import { chatBody } from "./server-chat.js";
import { serverArguments } from "./server-runtime.js";

const request = {
  protocolVersion: 2,
  requestId: "00000000-0000-4000-8000-000000000000",
  jobId: "00000000-0000-4000-8000-000000000001",
  operation: "generate",
  modelId: "qwen3.8-27b-ud-iq4_xs",
  prompt: "Respond.",
  jsonSchema: { type: "object" },
  maxTokens: 1,
} as const;

describe("generation context contract", () => {
  it("accepts automatic context and the 32K product ceiling", () => {
    expect(
      StructuredGenerationRequestSchema.safeParse({ ...request, contextSize: "auto" }).success,
    ).toBe(true);
    expect(
      StructuredGenerationRequestSchema.safeParse({ ...request, contextSize: 32_768 }).success,
    ).toBe(true);
  });

  it("rejects explicit generation context above the product ceiling", () => {
    expect(
      StructuredGenerationRequestSchema.safeParse({ ...request, contextSize: 32_769 }).success,
    ).toBe(false);
  });
});

it("sends the selected thinking level as the reasoning effort and no thinking budget", () => {
  const chat = (thinking: ChatGenerationRequest["thinking"]) =>
    ChatGenerationRequestSchema.parse({
      ...request,
      operation: "chat",
      prompt: undefined,
      jsonSchema: undefined,
      contextSize: "auto",
      messages: [{ role: "user", text: "Respond." }],
      tools: [],
      temperature: 0,
      thinking,
    });
  expect(chatBody(chat("low"), {}).chat_template_kwargs).toEqual({
    preserve_thinking: false,
    reasoning_effort: "low",
  });
  expect(chatBody(chat("none"), {}).chat_template_kwargs).toEqual({
    preserve_thinking: false,
    enable_thinking: false,
  });
  expect(Object.keys(chatBody(chat("medium"), {}))).not.toContain("reasoning_budget_tokens");
});

it("uses the Metal buffer name accepted by the pinned server", () => {
  const args = serverArguments({
    backend: "metal",
    modelPath: "model.gguf",
    contextTokens: 32768,
    speculation: "none",
  });
  expect(args[args.indexOf("--override-tensor") + 1]).toBe(".*=MTL0");
});

it("uses matching cache types for Metal Flash Attention", () => {
  const args = serverArguments({
    backend: "metal",
    modelPath: "model.gguf",
    contextTokens: 32768,
    speculation: "none",
  });
  expect(args[args.indexOf("--cache-type-k") + 1]).toBe(args[args.indexOf("--cache-type-v") + 1]);
});
