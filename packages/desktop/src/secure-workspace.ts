import type { SecureWorkspaceStatus } from "./api.js";
import { t } from "./i18n/index.js";

export function secureWorkspaceMessage(status: SecureWorkspaceStatus): string | undefined {
  return status.state === "ready" ? undefined : t(`secure.${status.state}`);
}

export function secureWorkspaceAllowsTasks(status: SecureWorkspaceStatus | undefined): boolean {
  return status?.state === "ready";
}
