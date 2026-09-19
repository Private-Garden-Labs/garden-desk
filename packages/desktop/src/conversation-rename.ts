import type { DesktopApi } from "./api.js";
import type { DesktopAction } from "./state.js";

interface RenameOptions {
  api: DesktopApi;
  sessionId: string;
  title: string;
  dispatch(action: DesktopAction): void;
  setError(message: string | undefined): void;
}

export async function renameConversation(options: RenameOptions) {
  const { api, sessionId, title, dispatch, setError } = options;
  setError(undefined);
  try {
    if (await api.renameSession(sessionId, title)) {
      dispatch({ type: "session.renamed", sessionId, title });
    }
  } catch {
    setError("The conversation could not be renamed.");
  }
}
