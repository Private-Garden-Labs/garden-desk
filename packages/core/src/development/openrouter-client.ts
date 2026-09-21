import { DEVELOPMENT_MODEL_SEARCH_LIMIT, type DevelopmentModel } from "@gardendesk/shared";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type OpenRouterFailureReason =
  | "authentication"
  | "credit"
  | "rate_limit"
  | "unsupported"
  | "connection"
  | "response";

const FAILURE_MESSAGES: Record<OpenRouterFailureReason, string> = {
  authentication: "OpenRouter did not accept the API key.",
  credit: "The OpenRouter account has no credit left.",
  rate_limit: "OpenRouter refused more requests for now. Try again later.",
  unsupported: "The selected OpenRouter model cannot do this request.",
  connection: "Garden Desk could not reach OpenRouter.",
  response: "OpenRouter sent a response that Garden Desk cannot use.",
};

/** Provider payloads stay out of the message; only the reason is kept. */
export class OpenRouterFailure extends Error {
  constructor(readonly reason: OpenRouterFailureReason) {
    super(FAILURE_MESSAGES[reason]);
  }
}

function failureReason(status: number): OpenRouterFailureReason {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "credit";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 404 || status === 422) return "unsupported";
  return "response";
}

export interface OpenRouterRequest {
  apiKey: string;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}

function requestOptions(request: OpenRouterRequest): RequestInit {
  const headers: Record<string, string> = { authorization: `Bearer ${request.apiKey}` };
  if (request.body !== undefined) headers["content-type"] = "application/json";
  return {
    method: request.body === undefined ? "GET" : "POST",
    headers,
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  };
}

export async function openRouterRequest(request: OpenRouterRequest): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE_URL}${request.path}`, requestOptions(request));
  } catch (error) {
    if (error instanceof DOMException) throw error;
    throw new OpenRouterFailure("connection");
  }
  if (response.ok) return response;
  await response.body?.cancel();
  throw new OpenRouterFailure(failureReason(response.status));
}

export async function openRouterJson(request: OpenRouterRequest): Promise<Record<string, unknown>> {
  const response = await openRouterRequest(request);
  try {
    return asRecord(await response.json());
  } catch {
    throw new OpenRouterFailure("response");
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function catalogModel(entry: unknown): DevelopmentModel | undefined {
  const record = asRecord(entry);
  const id = typeof record.id === "string" ? record.id : undefined;
  const name = typeof record.name === "string" ? record.name : id;
  const contextTokens = positiveInteger(record.context_length);
  const maxOutputTokens = positiveInteger(asRecord(record.top_provider).max_completion_tokens);
  if (id === undefined || name === undefined || contextTokens === undefined) return undefined;
  return {
    id,
    name,
    contextTokens,
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
  };
}

export async function searchOpenRouterModels(options: {
  apiKey: string;
  query: string;
  signal?: AbortSignal;
}): Promise<DevelopmentModel[]> {
  const search = new URLSearchParams({
    q: options.query,
    limit: String(DEVELOPMENT_MODEL_SEARCH_LIMIT),
    output_modalities: "text",
    supported_parameters: "tools",
  });
  const payload = await openRouterJson({
    apiKey: options.apiKey,
    path: `/models?${search.toString()}`,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const entries = Array.isArray(payload.data) ? payload.data : [];
  return entries
    .map(catalogModel)
    .filter((model): model is DevelopmentModel => model !== undefined)
    .slice(0, DEVELOPMENT_MODEL_SEARCH_LIMIT);
}
