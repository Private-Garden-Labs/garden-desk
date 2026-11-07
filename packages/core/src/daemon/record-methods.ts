import { type RpcRequest, type RpcResponse, SessionIdSchema } from "@gardendesk/shared";
import type { GardenDeskCore } from "../facade.js";
import { WORK_RECORD_LABELS, type WorkRecordLabels } from "../records/work-record.js";
import { failure, success } from "./responses.js";

function parseLabels(value: unknown): WorkRecordLabels | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const source = value as Record<string, unknown>;
  const entries = WORK_RECORD_LABELS.map((key) => [key, source[key]] as const);
  if (entries.some(([, label]) => typeof label !== "string")) return undefined;
  return Object.fromEntries(entries) as WorkRecordLabels;
}

export async function dispatchRecordMethod(
  core: GardenDeskCore,
  request: RpcRequest,
): Promise<RpcResponse> {
  const sessionId = SessionIdSchema.safeParse(request.params.sessionId);
  const { directory } = request.params;
  const labels = parseLabels(request.params.labels);
  if (!sessionId.success || typeof directory !== "string" || labels === undefined) {
    return failure(request, "invalid_request", "Invalid work record request.");
  }
  return success(request, await core.exportWorkRecord(sessionId.data, directory, labels));
}
