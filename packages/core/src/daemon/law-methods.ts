import {
  CompanyPackIdSchema,
  JurisdictionSchema,
  type RpcRequest,
  type RpcResponse,
} from "@gardendesk/shared";
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
  "companyPacks.status",
  "companyPacks.setFolder",
  "companyPacks.import",
  "companyPacks.build",
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
  if (request.method.startsWith("companyPacks.")) return companyPackMethod(core, request);
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

async function companyPackMethod(core: GardenDeskCore, request: RpcRequest): Promise<RpcResponse> {
  const { path, trust } = request.params;
  if (request.method === "companyPacks.status")
    return success(request, await core.companyPackStatus());
  if (request.method === "companyPacks.build") return buildCompanyPack(core, request);
  if (typeof path !== "string") return failure(request, "invalid_request", "Invalid path.");
  if (request.method === "companyPacks.setFolder") {
    await core.setCompanyPackFolder(path);
    return success(request, { saved: true });
  }
  const fingerprint = typeof trust === "string" ? trust : undefined;
  return success(request, { started: core.importCompanyPack(path, fingerprint) });
}

async function buildCompanyPack(core: GardenDeskCore, request: RpcRequest): Promise<RpcResponse> {
  const { sourcePath, name, id, publisher, outputDirectory } = request.params;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const pack = {
    source: text(sourcePath),
    name: text(name),
    id: text(id),
    publisher: text(publisher),
    output: text(outputDirectory),
  };
  const valid = CompanyPackIdSchema.safeParse(`company:${pack.id}`).success;
  if (Object.values(pack).includes("") || !valid)
    return failure(request, "invalid_request", "Invalid company pack.");
  return success(request, { started: await core.buildCompanyPack(pack) });
}
