import { JurisdictionSchema, type RpcRequest, type RpcResponse } from "@gardendesk/shared";
import type { GardenDeskCore } from "../facade.js";
import { failure, success } from "./responses.js";

export const LAW_METHODS = new Set([
  "laws.list",
  "laws.read",
  "laws.citations",
  "laws.sourceUrl",
  "laws.setEnabled",
  "dataPacks.list",
  "dataPacks.saveKey",
  "dataPacks.install",
]);

export async function dispatchLawMethod(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  if (request.method === "laws.list") return success(request, await core.listLaws());
  if (request.method === "laws.citations") return success(request, await core.lawCitations());
  if (request.method === "laws.read" || request.method === "laws.sourceUrl")
    return lawSource(core, request);
  if (request.method === "dataPacks.list") return success(request, await core.listDataPacks());
  if (request.method === "dataPacks.saveKey") return saveKey(core, request);
  if (request.method === "dataPacks.install") {
    const { id } = request.params;
    if (typeof id !== "string") return failure(request, "invalid_request", "Invalid data pack.");
    return success(request, { started: await core.installDataPack(id).catch(() => false) });
  }
  return setEnabled(core, request);
}

async function setEnabled(core: GardenDeskCore, request: RpcRequest): Promise<RpcResponse> {
  const id = JurisdictionSchema.safeParse(request.params.id);
  const { enabled, source } = request.params;
  const validSource = source === undefined || source === null || typeof source === "string";
  if (!id.success || typeof enabled !== "boolean" || !validSource)
    return failure(request, "invalid_request", "Invalid law setting.");
  return success(request, {
    changed: await core.setLawEnabled(id.data, enabled, source ?? undefined),
  });
}

async function saveKey(core: GardenDeskCore, request: RpcRequest): Promise<RpcResponse> {
  const key = typeof request.params.key === "string" ? request.params.key.trim() : "";
  if (!/^GD-[A-Z0-9-]{1,64}$/u.test(key)) return success(request, { status: "rejected" });
  try {
    const accepted = await core.saveDataPackKey(key);
    return success(request, { status: accepted ? "accepted" : "rejected" });
  } catch {
    return success(request, { status: "offline" });
  }
}

async function lawSource(core: GardenDeskCore, request: RpcRequest): Promise<RpcResponse> {
  const id = JurisdictionSchema.safeParse(request.params.id);
  const { source } = request.params;
  if (!id.success || typeof source !== "string")
    return failure(request, "invalid_request", "Invalid law.");
  const found =
    request.method === "laws.read"
      ? await core.readLaw(id.data, source)
      : await core
          .lawSourceUrl(id.data, source)
          .then((url) => (url?.startsWith("https://") === true ? url : undefined));
  return found === undefined
    ? failure(request, "not_found", "Unknown law.")
    : success(request, found);
}
