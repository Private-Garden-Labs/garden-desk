import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";
import { deleteConversation } from "./session-deletion.js";
import type { DesktopAction } from "./state.js";

type Dispatch = (action: DesktopAction) => void;
type SetError = (message: string | undefined) => void;

interface RevokeFolderConfirmation {
  api: DesktopApi;
  dispatch: Dispatch;
  folderId: string;
  folderName: string | undefined;
  setError: SetError;
}

export function revokeFolderConfirmation(request: RevokeFolderConfirmation) {
  const { api, dispatch, folderId, folderName, setError } = request;
  return {
    title: t("confirm.unmountTitle", { name: folderName ?? t("confirm.thisFolder") }),
    description: t("confirm.unmountDescription"),
    confirmLabel: t("confirm.unmount"),
    onConfirm: () => {
      void api
        .revokeFolder(folderId)
        .then((revoked) => {
          if (revoked) dispatch({ type: "folder.revoked", folderId });
        })
        .catch(() => setError(t("error.folderUnmount")));
    },
  };
}

interface DeleteSessionConfirmation {
  api: DesktopApi;
  dispatch: Dispatch;
  session: { id: string; folderId: string | null; title: string };
  visibleCount: number;
  setError: SetError;
}

export function deleteSessionConfirmation(request: DeleteSessionConfirmation) {
  const { api, dispatch, session, visibleCount, setError } = request;
  return {
    title: t("confirm.deleteTitle", { title: session.title }),
    description: t("confirm.deleteDescription"),
    confirmLabel: t("confirm.delete"),
    onConfirm: () => void deleteConversation({ api, session, visibleCount, dispatch, setError }),
  };
}
