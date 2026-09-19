import {
  FolderIdSchema,
  type RpcRequest,
  type RpcResponse,
  SessionIdSchema,
  SessionTitleSchema,
} from "@gardendesk/shared";
import type { GardenDeskCore } from "../facade.js";
import { failure, success } from "./responses.js";

function nullableFolderId(value: unknown): string | null | undefined {
  if (value === null) return null;
  const parsed = FolderIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export async function createSession(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const folderId = nullableFolderId(request.params.folderId);
  if (folderId === undefined) return failure(request, "invalid_request", "Invalid folder id.");
  return success(request, await core.createSession(folderId));
}

export async function deleteSession(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const sessionId = SessionIdSchema.safeParse(request.params.sessionId);
  if (!sessionId.success) return failure(request, "invalid_request", "Invalid session id.");
  return success(request, { deleted: await core.deleteSession(sessionId.data) });
}

export async function renameSession(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const sessionId = SessionIdSchema.safeParse(request.params.sessionId);
  const title = SessionTitleSchema.safeParse(request.params.title);
  if (!sessionId.success) return failure(request, "invalid_request", "Invalid session id.");
  if (!title.success) return failure(request, "invalid_request", "Invalid conversation name.");
  return success(request, { renamed: await core.renameSession(sessionId.data, title.data) });
}

export async function listSessions(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const folderId = nullableFolderId(request.params.folderId);
  if (folderId === undefined) return failure(request, "invalid_request", "Invalid folder id.");
  const { cursor, limit } = request.params;
  if (cursor !== undefined && typeof cursor !== "string") {
    return failure(request, "invalid_request", "Invalid session cursor.");
  }
  if (limit !== undefined && typeof limit !== "number") {
    return failure(request, "invalid_request", "Invalid page limit.");
  }
  return success(request, await core.listSessions(folderId, cursor, limit));
}
