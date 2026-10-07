import { JurisdictionSchema, type RpcRequest, type RpcResponse } from "@gardendesk/shared";
import type { GardenDeskCore } from "../facade.js";
import { failure, success } from "./responses.js";

export async function dispatchLawMethod(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  if (request.method === "laws.list") return success(request, await core.listLaws());
  const id = JurisdictionSchema.safeParse(request.params.id);
  const { enabled } = request.params;
  if (!id.success || typeof enabled !== "boolean")
    return failure(request, "invalid_request", "Invalid law setting.");
  return success(request, { changed: await core.setLawEnabled(id.data, enabled) });
}
