import {
  type ErrorCode,
  PROTOCOL_VERSION,
  type RpcRequest,
  type RpcResponse,
} from "@gardendesk/shared";

export function failure(
  request: RpcRequest | undefined,
  code: ErrorCode,
  message: string,
): RpcResponse {
  return {
    jsonrpc: "2.0",
    id: request?.id ?? null,
    error: { code, message },
    protocolVersion: PROTOCOL_VERSION,
  };
}

export function success(request: RpcRequest, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id: request.id, result, protocolVersion: PROTOCOL_VERSION };
}
