import type { AuditEventInput, ChatMessage, DevelopmentModel } from "@gardendesk/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatInput } from "../runtime/inference.js";
import { OpenRouterRuntime } from "./openrouter-runtime.js";

const MODEL: DevelopmentModel = {
  id: "vendor/model",
  name: "Vendor Model",
  contextTokens: 128_000,
  maxOutputTokens: 4_096,
};

function event(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const CHUNKS = [
  event({
    choices: [
      {
        delta: {
          reasoning: "Checking. ",
          reasoning_details: [{ index: 0, type: "reasoning.text", text: "Checking. " }],
        },
      },
    ],
  }),
  event({ choices: [{ delta: { content: "Listing" } }] }),
  event({ choices: [{ delta: { content: " files." } }] }),
  event({
    choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", function: { name: "list" } }] } }],
  }),
  event({
    choices: [
      {
        delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":"/source"}' } }] },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 30 },
  }),
  "data: [DONE]\n\n",
];

const INPUT: ChatInput = {
  modelId: "qwen3.8-27b-ud-iq4_xs",
  messages: [{ role: "user", text: "List the files." }],
  tools: [{ name: "list", description: "List files.", params: { type: "object" } }],
  contextSize: "auto",
  maxTokens: 32_768,
  temperature: 0.7,
  thinking: "medium",
};

function stubFetch(bodies: string[]): void {
  const encoder = new TextEncoder();
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    init.signal?.throwIfAborted();
    bodies.push(String(init.body));
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of CHUNKS) controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      }),
      { status: 200 },
    );
  });
}

function runtime(audit: AuditEventInput[] = []) {
  return new OpenRouterRuntime({
    model: MODEL,
    apiKey: "sk-or-development-key",
    audit: (entry) => audit.push(entry),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter chat", () => {
  it("maps the streamed reply, tool call, usage, and audit outcome", async () => {
    const bodies: string[] = [];
    const audit: AuditEventInput[] = [];
    const responses: string[] = [];
    const thinking: string[] = [];
    stubFetch(bodies);
    const result = await runtime(audit).chat(INPUT, undefined, {
      reasoning: new Map(),
      onResponseDelta: (text) => responses.push(text),
      onThinkingDelta: (text) => thinking.push(text),
    });
    expect(result.text).toBe("Listing files.");
    expect(result.toolCalls).toEqual([{ id: "call-1", name: "list", params: { path: "/source" } }]);
    expect(result.stopReason).toBe("toolCalls");
    expect(result.contextUsedTokens).toBe(150);
    expect(result.contextBudgetTokens).toBe(32_768);
    expect(result.memory).toBeUndefined();
    expect(result.performance).toMatchObject({ promptTokens: 120, outputTokens: 30 });
    expect(responses).toEqual(["Listing", " files."]);
    expect(thinking).toEqual(["Checking. "]);
    expect(audit).toEqual([
      {
        type: "inference.development_request",
        outcome: "succeeded",
        metadata: { provider: "openrouter", modelId: "vendor/model", operation: "chat" },
      },
    ]);
  });
});

describe("OpenRouter requests", () => {
  it("returns the retained reasoning with the next tool-call request", async () => {
    const bodies: string[] = [];
    const reasoning = new Map<string, string>();
    stubFetch(bodies);
    const cloud = runtime();
    await cloud.chat(INPUT, undefined, { reasoning });
    expect(reasoning.get("call-1")).toContain("Checking. ");
    expect(JSON.parse(bodies[0] as string)).toMatchObject({
      model: "vendor/model",
      max_tokens: 4_096,
      reasoning: { effort: "medium" },
      stream: true,
    });
    const history: ChatMessage[] = [
      ...INPUT.messages,
      {
        role: "assistant",
        text: "Listing files.",
        toolCalls: [{ id: "call-1", name: "list", params: { path: "/source" } }],
      },
      { role: "tool", toolCallId: "call-1", name: "list", result: "report.txt" },
    ];
    await cloud.chat({ ...INPUT, messages: history }, undefined, { reasoning });
    const sent = JSON.parse(bodies[1] as string) as { messages: Record<string, unknown>[] };
    expect(sent.messages[1]).toMatchObject({
      role: "assistant",
      reasoning_details: [{ text: "Checking. " }],
    });
  });

  it("stops a cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch([]);
    await expect(runtime().chat(INPUT, controller.signal)).rejects.toThrow();
  });
});
