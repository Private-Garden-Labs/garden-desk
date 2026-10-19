import { useCallback, useEffect, useRef, useState } from "react";
import type { DesktopApi, SecureWorkspaceStatus } from "./api.js";
import type { ConfirmationRequest } from "./components/confirmation.js";
import { t } from "./i18n/index.js";

export function useSecureWorkspace(
  api: DesktopApi,
  setConfirmation: (request: ConfirmationRequest | undefined) => void,
  setError: (message: string) => void,
) {
  const [status, setStatus] = useState<SecureWorkspaceStatus>();
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  const configure = useCallback(() => {
    setBusy(true);
    void api
      .configureSecureWorkspace()
      .then((result) => setStatus(result.status))
      .catch(() => setError(t("error.workspaceConfigure")))
      .finally(() => setBusy(false));
  }, [api, setError]);

  const showSetup = useCallback(() => {
    setConfirmation({
      cancelLabel: t("secure.limitedMode"),
      confirmLabel: t("secure.setUp"),
      description: t("secure.setupDescription"),
      intent: "primary",
      onConfirm: configure,
      title: t("secure.setupTitle"),
    });
  }, [configure, setConfirmation]);

  useEffect(() => {
    void api
      .getSecureWorkspaceStatus()
      .then(setStatus)
      .catch(() => setError(t("error.workspaceStatus")));
  }, [api, setError]);

  useEffect(() => {
    if (status?.state === "permission_required" && !prompted.current) {
      prompted.current = true;
      showSetup();
    }
  }, [showSetup, status?.state]);

  return { busy, showSetup, status };
}
