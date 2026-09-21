import { randomUUID } from "node:crypto";
import type {
  AuditEventInput,
  DevelopmentModel,
  ErrorCode,
  InferencePerformance,
} from "@gardendesk/shared";
import type {
  ChatCompletion,
  ChatInput,
  GenerationInput,
  GenerationRequestIdentity,
  InferenceStreamCallbacks,
  StructuredCompletion,
} from "../runtime/inference.js";
import { InferenceFailure } from "../runtime/inference-errors.js";
import { inferenceTimeoutMs } from "../runtime/inference-timeout.js";
import {
  createChatWorkerRequest,
  createGenerateWorkerRequest,
} from "../runtime/supervisor-requests.js";
import {
  asRecord,
  OpenRouterFailure,
  type OpenRouterFailureReason,
  openRouterJson,
  openRouterRequest,
  type ProviderPriceBudget,
} from "./openrouter-client.js";
import {
  chatRequestBody,
  contextBudgetTokens,
  outputTokenLimit,
  providerRouting,
} from "./openrouter-messages.js";
import { readChatStream, type StreamedCompletion } from "./openrouter-stream.js";

const FAILURE_CODES: Record<OpenRouterFailureReason, ErrorCode> = {
  authentication: "invalid_request",
  credit: "invalid_request",
  rate_limit: "workspace_busy",
  unsupported: "unsupported",
  connection: "internal",
  response: "malformed_worker_message",
};

export interface OpenRouterRuntimeOptions {
  model: DevelopmentModel;
  apiKey: string;
  budget?: ProviderPriceBudget;
  audit(event: AuditEventInput): void;
}

function requestSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

function inferenceError(error: unknown): unknown {
  return error instanceof OpenRouterFailure
    ? new InferenceFailure(FAILURE_CODES[error.reason], error.message)
    : error;
}

/** Locally measured request timings; no provider or llama.cpp server timings are invented. */
function measuredPerformance(
  completion: Pick<StreamedCompletion, "promptTokens" | "outputTokens" | "firstTokenAt">,
  startedAt: number,
): InferencePerformance {
  const finishedAt = Date.now();
  const firstTokenAt = completion.firstTokenAt ?? finishedAt;
  return {
    promptTokens: completion.promptTokens,
    outputTokens: completion.outputTokens,
    promptDurationMs: firstTokenAt - startedAt,
    generationDurationMs: finishedAt - firstTokenAt,
    totalDurationMs: finishedAt - startedAt,
  };
}

function stopReason(completion: StreamedCompletion): ChatCompletion["stopReason"] {
  if (completion.toolCalls.length > 0) return "toolCalls";
  return completion.finishReason === "length" ? "maxTokens" : "text";
}

function retainReasoning(completion: StreamedCompletion, reasoning?: Map<string, string>): void {
  const first = completion.toolCalls[0];
  if (reasoning === undefined || first === undefined) return;
  if (completion.reasoningDetails.length === 0) return;
  reasoning.set(first.id, JSON.stringify(completion.reasoningDetails));
}

function structuredValue(payload: Record<string, unknown>): unknown {
  const choice = asRecord(Array.isArray(payload.choices) ? payload.choices[0] : undefined);
  const content = asRecord(choice.message).content;
  if (typeof content !== "string") throw new OpenRouterFailure("response");
  try {
    return JSON.parse(content);
  } catch {
    throw new OpenRouterFailure("response");
  }
}

function structuredUsage(payload: Record<string, unknown>) {
  const usage = asRecord(payload.usage);
  return {
    promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0,
    outputTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0,
    firstTokenAt: undefined,
  };
}

/** Cloud inference for the development workflow. It never resolves or loads a local model. */
export class OpenRouterRuntime {
  constructor(private readonly options: OpenRouterRuntimeOptions) {}

  private record(operation: "chat" | "generate", outcome: "succeeded" | "failed"): void {
    this.options.audit({
      type: "inference.development_request",
      outcome,
      metadata: { provider: "openrouter", modelId: this.options.model.id, operation },
    });
  }

  private async run<Result>(
    operation: "chat" | "generate",
    work: () => Promise<Result>,
  ): Promise<Result> {
    try {
      const result = await work();
      this.record(operation, "succeeded");
      return result;
    } catch (error) {
      this.record(operation, "failed");
      throw inferenceError(error);
    }
  }

  async chat(
    input: ChatInput,
    signal?: AbortSignal,
    streams?: InferenceStreamCallbacks,
    identity?: GenerationRequestIdentity,
  ): Promise<ChatCompletion> {
    const { apiKey, model } = this.options;
    const timeoutMs = inferenceTimeoutMs(createChatWorkerRequest(input, identity));
    const startedAt = Date.now();
    return await this.run("chat", async () => {
      const response = await openRouterRequest({
        apiKey,
        path: "/chat/completions",
        body: chatRequestBody({
          model,
          input,
          ...(this.options.budget === undefined ? {} : { budget: this.options.budget }),
          ...(streams?.reasoning === undefined ? {} : { reasoning: streams.reasoning }),
        }),
        signal: requestSignal(timeoutMs, signal),
      });
      const completion = await readChatStream(response, streams);
      retainReasoning(completion, streams?.reasoning);
      return {
        protocolVersion: 2 as const,
        requestId: identity?.requestId ?? randomUUID(),
        status: "ok" as const,
        operation: "chat" as const,
        text: completion.text,
        toolCalls: completion.toolCalls,
        stopReason: stopReason(completion),
        contextUsedTokens: completion.promptTokens + completion.outputTokens,
        contextBudgetTokens: contextBudgetTokens(model),
        performance: measuredPerformance(completion, startedAt),
      };
    });
  }

  async generate(
    input: GenerationInput,
    signal?: AbortSignal,
    _onThinkingDelta?: (text: string) => void,
    identity?: GenerationRequestIdentity,
  ): Promise<StructuredCompletion> {
    const { apiKey, model } = this.options;
    const timeoutMs = inferenceTimeoutMs(createGenerateWorkerRequest(input, identity));
    const startedAt = Date.now();
    return await this.run("generate", async () => {
      const payload = await openRouterJson({
        apiKey,
        path: "/chat/completions",
        body: {
          model: model.id,
          messages: [{ role: "user", content: input.prompt }],
          max_tokens: outputTokenLimit(model, input.maxTokens),
          provider: providerRouting(this.options.budget),
          response_format: {
            type: "json_schema",
            json_schema: { name: "result", strict: true, schema: input.jsonSchema },
          },
          usage: { include: true },
        },
        signal: requestSignal(timeoutMs, signal),
      });
      return {
        protocolVersion: 2 as const,
        requestId: identity?.requestId ?? randomUUID(),
        status: "ok" as const,
        operation: "generate" as const,
        value: structuredValue(payload),
        contextBudgetTokens: contextBudgetTokens(model),
        performance: measuredPerformance(structuredUsage(payload), startedAt),
      };
    });
  }
}
