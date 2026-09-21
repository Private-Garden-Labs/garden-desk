import type { ChatMessage, DevelopmentModel, ThinkingLevel } from "@gardendesk/shared";
import type { ChatInput } from "../runtime/inference.js";
import type { ProviderPriceBudget } from "./openrouter-client.js";

/** Development runs use the local hardware for nothing, so the local window does not apply. */
const DEVELOPMENT_CONTEXT_LIMIT_TOKENS = 131_072;

/**
 * OpenRouter spreads one model across independent hosts whose speed differs by several times.
 * A development run asks for the fastest host inside today's middle price, and keeps fallbacks
 * so one busy host cannot fail the run.
 *
 * Without today's prices, the run asks for the cheapest host instead. An unexpected slow answer
 * is better than an unexpected bill.
 */
export function providerRouting(budget?: ProviderPriceBudget): Record<string, unknown> {
  if (budget === undefined) return { sort: "price", allow_fallbacks: true };
  return { sort: "throughput", allow_fallbacks: true, max_price: budget };
}

const REASONING_EFFORT: Record<Exclude<ThinkingLevel, "none">, string> = {
  low: "low",
  medium: "medium",
  xhigh: "high",
};

/** The effective window is the smaller of the catalog limit and the development limit. */
export function contextBudgetTokens(model: DevelopmentModel): number {
  return Math.min(model.contextTokens, DEVELOPMENT_CONTEXT_LIMIT_TOKENS);
}

export function outputTokenLimit(model: DevelopmentModel, requested: number): number {
  return model.maxOutputTokens === undefined
    ? requested
    : Math.min(requested, model.maxOutputTokens);
}

function reasoningRequest(thinking: ThinkingLevel) {
  return thinking === "none"
    ? { reasoning: { enabled: false } }
    : { reasoning: { effort: REASONING_EFFORT[thinking] } };
}

function retainedReasoning(
  message: Extract<ChatMessage, { role: "assistant" }>,
  reasoning?: Map<string, string>,
): { reasoning_details: unknown } | Record<string, never> {
  const stored = reasoning?.get(message.toolCalls[0]?.id ?? "");
  if (stored === undefined) return {};
  try {
    return { reasoning_details: JSON.parse(stored) };
  } catch {
    return {};
  }
}

function assistantMessage(
  message: Extract<ChatMessage, { role: "assistant" }>,
  reasoning?: Map<string, string>,
): unknown {
  return {
    role: "assistant",
    content: message.text,
    ...retainedReasoning(message, reasoning),
    ...(message.toolCalls.length === 0
      ? {}
      : {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.params) },
          })),
        }),
  };
}

export function completionMessages(
  messages: ChatMessage[],
  reasoning?: Map<string, string>,
): unknown[] {
  return messages.map((message) => {
    if (message.role === "tool")
      return { role: "tool", tool_call_id: message.toolCallId, content: message.result };
    if (message.role !== "assistant") return { role: message.role, content: message.text };
    return assistantMessage(message, reasoning);
  });
}

function completionTools(tools: ChatInput["tools"]): unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.params },
  }));
}

export function chatRequestBody(options: {
  model: DevelopmentModel;
  input: ChatInput;
  reasoning?: Map<string, string>;
  budget?: ProviderPriceBudget;
}): Record<string, unknown> {
  const { input, model } = options;
  return {
    model: model.id,
    messages: completionMessages(input.messages, options.reasoning),
    ...(input.tools.length === 0 ? {} : { tools: completionTools(input.tools) }),
    max_tokens: outputTokenLimit(model, input.maxTokens),
    temperature: input.temperature,
    provider: providerRouting(options.budget),
    stream: true,
    usage: { include: true },
    ...reasoningRequest(input.thinking),
  };
}
