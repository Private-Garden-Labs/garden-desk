import { DevelopmentModelListSchema, type RpcRequest, type RpcResponse } from "@gardendesk/shared";
import type { DevelopmentPorts } from "../development/ports.js";
import type { GardenDeskCore } from "../facade.js";
import { failure, success } from "./responses.js";

const UNAVAILABLE = "The request could not be completed.";

/** Keeps provider payloads, keys, and local paths out of the returned message. */
function boundedMessage(error: unknown): string {
  if (!(error instanceof Error)) return UNAVAILABLE;
  if (error.message === "development_model_key_missing") return "Save a development API key first.";
  if (error.message === "development_model_unavailable")
    return "That model is not in the saved favorites.";
  return error.message.length <= 120 && !error.message.includes("/") ? error.message : UNAVAILABLE;
}

function stringParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function searchModels(
  development: DevelopmentPorts,
  request: RpcRequest,
): Promise<RpcResponse> {
  const query = stringParam(request.params.query);
  if (query === undefined) return success(request, []);
  const apiKey = stringParam(request.params.apiKey);
  return success(request, await development.searchModels(query, apiKey));
}

async function saveSettings(
  development: DevelopmentPorts,
  request: RpcRequest,
): Promise<RpcResponse> {
  const favorites = DevelopmentModelListSchema.safeParse(request.params.favorites);
  if (!favorites.success) return failure(request, "invalid_request", "Invalid model favorites.");
  const apiKey = stringParam(request.params.apiKey);
  return success(
    request,
    await development.saveModelSettings({
      favorites: favorites.data,
      ...(apiKey === undefined ? {} : { apiKey }),
    }),
  );
}

/** Development operations stop here in a production build, before settings or network access. */
export async function dispatchDevelopmentMethod(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const development = core.development;
  if (development === undefined)
    return failure(request, "unsupported", `Unsupported method: ${request.method}`);
  try {
    if (request.method === "development.models.settings")
      return success(request, await development.modelSettings());
    if (request.method === "development.models.search")
      return await searchModels(development, request);
    return await saveSettings(development, request);
  } catch (error) {
    return failure(request, "internal", boundedMessage(error));
  }
}
