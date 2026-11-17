import type { ChatToolCall } from "@gardendesk/shared";
import type { InferenceStreamCallbacks } from "../runtime/inference.js";
import { asRecord } from "./openrouter-client.js";

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface StreamState {
  text: string;
  calls: Map<number, PendingToolCall>;
  details: Map<number, Record<string, unknown>>;
  finishReason: string;
  promptTokens: number;
  outputTokens: number;
  firstTokenAt: number | undefined;
}

export interface StreamedCompletion {
  text: string;
  toolCalls: ChatToolCall[];
  reasoningDetails: unknown[];
  finishReason: string;
  promptTokens: number;
  outputTokens: number;
  firstTokenAt: number | undefined;
}

function streamEvent(line: string): Record<string, unknown> | "done" | undefined {
  if (!line.startsWith("data:")) return undefined;
  const data = line.slice(5).trim();
  if (data === "[DONE]") return "done";
  try {
    return asRecord(JSON.parse(data));
  } catch {
    return undefined;
  }
}

interface ChunkEvents {
  events: Record<string, unknown>[];
  buffer: string;
  done: boolean;
}

function chunkEvents(buffer: string): ChunkEvents {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: Record<string, unknown>[] = [];
  for (const line of lines) {
    const event = streamEvent(line.trim());
    if (event === "done") return { events, buffer: "", done: true };
    if (event !== undefined) events.push(event);
  }
  return { events, buffer: rest, done: false };
}

async function* serverEvents(body: AsyncIterable<Buffer>): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    const parsed = chunkEvents(buffer + decoder.decode(chunk, { stream: true }));
    buffer = parsed.buffer;
    yield* parsed.events;
    if (parsed.done) return;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function applyToolDeltas(calls: Map<number, PendingToolCall>, deltas: unknown): void {
  if (!Array.isArray(deltas)) return;
  for (const entry of deltas) {
    const record = asRecord(entry);
    const index = typeof record.index === "number" ? record.index : 0;
    const call = asRecord(record.function);
    const current = calls.get(index) ?? { id: "", name: "", arguments: "" };
    calls.set(index, {
      id: text(record.id) || current.id,
      name: text(call.name) || current.name,
      arguments: current.arguments + text(call.arguments),
    });
  }
}

function mergeDetail(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const joined = text(current.text) + text(next.text);
  return { ...current, ...next, ...(joined.length === 0 ? {} : { text: joined }) };
}

function applyReasoningDetails(details: StreamState["details"], value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    const record = asRecord(entry);
    const index = typeof record.index === "number" ? record.index : details.size;
    const current = details.get(index);
    details.set(index, current === undefined ? record : mergeDetail(current, record));
  }
}

function applyDelta(
  state: StreamState,
  delta: Record<string, unknown>,
  streams?: InferenceStreamCallbacks,
): void {
  const content = text(delta.content);
  const thinking = text(delta.reasoning);
  if (content.length > 0 || thinking.length > 0) state.firstTokenAt ??= Date.now();
  if (content.length > 0) {
    state.text += content;
    streams?.onResponseDelta?.(content);
  }
  if (thinking.length > 0) streams?.onThinkingDelta?.(thinking);
  applyReasoningDetails(state.details, delta.reasoning_details);
  applyToolDeltas(state.calls, delta.tool_calls);
}

function applyUsage(state: StreamState, usage: unknown): void {
  const record = asRecord(usage);
  if (typeof record.prompt_tokens === "number") state.promptTokens = record.prompt_tokens;
  if (typeof record.completion_tokens === "number") state.outputTokens = record.completion_tokens;
}

function toolCallParams(argumentText: string): unknown {
  if (argumentText.trim().length === 0) return {};
  try {
    return JSON.parse(argumentText);
  } catch {
    return {};
  }
}

function completed(state: StreamState): StreamedCompletion {
  return {
    text: state.text,
    toolCalls: [...state.calls.values()]
      .filter((call) => call.name.length > 0)
      .map((call, index) => ({
        id: call.id.length > 0 ? call.id : `call-${index}`,
        name: call.name,
        params: toolCallParams(call.arguments),
      })),
    reasoningDetails: [...state.details.values()],
    finishReason: state.finishReason,
    promptTokens: state.promptTokens,
    outputTokens: state.outputTokens,
    firstTokenAt: state.firstTokenAt,
  };
}

export async function readChatStream(
  body: AsyncIterable<Buffer>,
  streams?: InferenceStreamCallbacks,
): Promise<StreamedCompletion> {
  const state: StreamState = {
    text: "",
    calls: new Map(),
    details: new Map(),
    finishReason: "",
    promptTokens: 0,
    outputTokens: 0,
    firstTokenAt: undefined,
  };
  for await (const event of serverEvents(body)) {
    applyUsage(state, event.usage);
    const choice = asRecord(Array.isArray(event.choices) ? event.choices[0] : undefined);
    applyDelta(state, asRecord(choice.delta), streams);
    if (typeof choice.finish_reason === "string") state.finishReason = choice.finish_reason;
  }
  return completed(state);
}
