import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";
import type { DesktopAction } from "./state.js";

interface DeleteConversationOptions {
  api: DesktopApi;
  session: { id: string; folderId: string | null };
  visibleCount: number;
  dispatch(action: DesktopAction): void;
  setError(message: string | undefined): void;
}

export async function deleteConversation(options: DeleteConversationOptions) {
  const { api, session, visibleCount, dispatch, setError } = options;
  setError(undefined);
  try {
    await api.deleteSession(session.id);
  } catch (error) {
    setError(
      String(error).includes("Stop the running conversation before deleting it.")
        ? t("error.sessionDeleteRunning")
        : t("error.sessionDelete"),
    );
    return;
  }
  dispatch({ type: "session.deleted", sessionId: session.id });
  try {
    let cursor: string | undefined;
    const items = [] as Awaited<ReturnType<DesktopApi["listSessions"]>>["items"];
    let nextCursor: string | null;
    do {
      const page = await api.listSessions(session.folderId, cursor);
      items.push(...page.items);
      nextCursor = page.nextCursor;
      cursor = nextCursor ?? undefined;
    } while (nextCursor !== null && items.length < visibleCount);
    const page = { items, nextCursor };
    dispatch(
      session.folderId === null
        ? { type: "global.refresh", page }
        : { type: "folder.refresh", folderId: session.folderId, page },
    );
  } catch {
    setError(t("error.sessionsRefresh"));
  }
}
