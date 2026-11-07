import { randomUUID } from "node:crypto";
import type {
  EmbeddingResult,
  InferenceWorkerRequest,
  InferenceWorkerResponse,
} from "@gardendesk/shared";
import { JobIdSchema } from "@gardendesk/shared";
import type {
  ChatCompletion,
  ChatInput,
  EmbeddingInput,
  GenerationInput,
  GenerationRequestIdentity,
  StructuredCompletion,
} from "./inference.js";
import { createGenerationRequest } from "./inference.js";

export function createGenerateWorkerRequest(
  input: GenerationInput,
  identity?: GenerationRequestIdentity,
): InferenceWorkerRequest {
  const request = createGenerationRequest(input, identity);
  return {
    protocolVersion: 2,
    requestId: request.identity.requestId,
    jobId: request.identity.jobId,
    operation: "generate",
    ...request.input,
  };
}

export function createChatWorkerRequest(
  input: ChatInput,
  identity: GenerationRequestIdentity = {
    requestId: randomUUID(),
    jobId: JobIdSchema.parse(randomUUID()),
  },
): InferenceWorkerRequest {
  return {
    protocolVersion: 2,
    requestId: identity.requestId,
    jobId: identity.jobId,
    operation: "chat",
    ...input,
  };
}

export function createEmbedWorkerRequest(input: EmbeddingInput): InferenceWorkerRequest {
  return {
    protocolVersion: 2,
    requestId: randomUUID(),
    jobId: JobIdSchema.parse(randomUUID()),
    operation: "embed",
    ...input,
  };
}

function contextBudget(memory: { contextSizeTokens?: number | undefined }) {
  return memory.contextSizeTokens === undefined
    ? {}
    : { contextBudgetTokens: memory.contextSizeTokens };
}

export function expectGenerateResponse(response: InferenceWorkerResponse): StructuredCompletion {
  if (response.status !== "ok" || response.operation !== "generate") {
    throw new Error("unexpected_inference_response");
  }
  return { ...response, ...contextBudget(response.memory) };
}

export function expectChatResponse(response: InferenceWorkerResponse): ChatCompletion {
  if (response.status !== "ok" || response.operation !== "chat") {
    throw new Error("unexpected_inference_response");
  }
  return { ...response, ...contextBudget(response.memory) };
}

export function expectEmbedResponse(response: InferenceWorkerResponse): EmbeddingResult {
  if (response.status !== "ok" || response.operation !== "embed") {
    throw new Error("unexpected_inference_response");
  }
  return response;
}
