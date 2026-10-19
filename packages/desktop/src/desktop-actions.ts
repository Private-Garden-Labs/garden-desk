import type { ThinkingLevel } from "@gardendesk/shared";
import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";
import { retryLocalRequest, waitForAgentRun } from "./run-polling.js";
import { loadSessionActivity } from "./session-activity.js";
import type { DesktopAction } from "./state.js";

type Dispatch = (action: DesktopAction) => void;
type SetError = (message: string | undefined) => void;

export async function addFolder(api: DesktopApi, dispatch: Dispatch, setError: SetError) {
  setError(undefined);
  try {
    const folder = await api.chooseFolder();
    if (folder !== undefined) dispatch({ type: "folder.add", folder });
  } catch {
    setError(t("error.folderAdd"));
  }
}

export async function addDroppedFolders(
  api: DesktopApi,
  paths: string[],
  dispatch: Dispatch,
  setError: SetError,
) {
  setError(undefined);
  try {
    const folders = await api.addFolders(paths);
    for (const folder of folders) {
      dispatch({ type: "folder.add", folder });
    }
    const activeFolder = folders.at(-1);
    if (activeFolder !== undefined) {
      dispatch({ type: "session.new", folderId: activeFolder.id });
    }
  } catch {
    setError(t("error.foldersDropped"));
  }
}

export async function reorderFolders(
  api: DesktopApi,
  folderIds: string[],
  dispatch: Dispatch,
  setError: SetError,
) {
  setError(undefined);
  try {
    const folders = await api.reorderFolders(folderIds);
    dispatch({ type: "folders.reorder", folderIds: folders.map((folder) => folder.id) });
  } catch {
    setError(t("error.folderOrder"));
  }
}

async function openWithError(open: () => Promise<void>, setError: SetError, failure: string) {
  setError(undefined);
  try {
    await open();
  } catch {
    setError(failure);
  }
}

export async function showFolder(api: DesktopApi, folderId: string, setError: SetError) {
  await openWithError(() => api.openFolder(folderId), setError, t("error.folderOpen"));
}

export async function showCatalogFolder(api: DesktopApi, setError: SetError) {
  await openWithError(() => api.openCatalogFolder(), setError, t("error.folderOpen"));
}

interface StartSessionOptions {
  api: DesktopApi;
  dispatch: Dispatch;
  draft?: string;
  folderId: string | null;
  setError: SetError;
}

async function startSession(options: StartSessionOptions) {
  const { api, dispatch, draft, folderId, setError } = options;
  setError(undefined);
  try {
    const session = await api.createSession(folderId);
    dispatch({ type: "session.created", session });
    if (draft !== undefined) dispatch({ type: "draft.change", draft });
    if (folderId !== null) {
      dispatch({ type: "folder.refresh", folderId, page: await api.listSessions(folderId) });
    }
    return session.id;
  } catch {
    setError(t("error.sessionCreate"));
    return undefined;
  }
}

export async function selectSession(
  api: DesktopApi,
  sessionId: string,
  dispatch: Dispatch,
  setError: SetError,
) {
  setError(undefined);
  dispatch({ type: "session.select", sessionId });
  try {
    const [messages, attachments, draft, activity] = await Promise.all([
      api.listMessages(sessionId),
      api.listAttachments(sessionId),
      api.loadDraft(sessionId),
      loadSessionActivity(api, sessionId),
    ]);
    const lastUserMessage = messages.filter((message) => message.role === "user").at(-1);
    dispatch({
      type: "session.loaded",
      sessionId,
      messages,
      attachments,
      removableIds: attachments
        .filter(
          (item) => lastUserMessage === undefined || item.createdAt > lastUserMessage.createdAt,
        )
        .map((item) => item.id),
      draft: draft?.content ?? "",
      snapshots: activity.snapshots,
    });
    if (activity.incomplete) {
      setError(t("error.activityPartial"));
    }
  } catch {
    dispatch({ type: "session.load.failed", sessionId });
    setError(t("error.sessionLoad"));
  }
}

interface ShowMoreOptions {
  api: DesktopApi;
  folderId: string | null;
  cursor: string | null;
  dispatch: Dispatch;
  setError: SetError;
}

export async function showMore(options: ShowMoreOptions) {
  const { api, folderId, cursor, dispatch, setError } = options;
  if (cursor === null) return;
  try {
    const page = await api.listSessions(folderId, cursor);
    dispatch(
      folderId === null ? { type: "global.page", page } : { type: "folder.page", folderId, page },
    );
  } catch {
    setError(t("error.sessionsMore"));
  }
}

export async function showLess(options: Omit<ShowMoreOptions, "cursor">) {
  const { api, folderId, dispatch, setError } = options;
  try {
    const page = await api.listSessions(folderId);
    dispatch(
      folderId === null
        ? { type: "global.refresh", page }
        : { type: "folder.refresh", folderId, page },
    );
  } catch {
    setError(t("error.sessionsRefresh"));
  }
}

interface SendOptions {
  api: DesktopApi;
  text: string;
  thinking: ThinkingLevel;
  activeSessionId: string | undefined;
  newSessionFolderId: string | null | undefined;
  dispatch: Dispatch;
  setError: SetError;
  setSubmitting(value: boolean): void;
}

export async function send(options: SendOptions) {
  const { api, text, activeSessionId, newSessionFolderId, dispatch, setError, setSubmitting } =
    options;
  setSubmitting(true);
  setError(undefined);
  let started = false;
  try {
    const sessionId =
      activeSessionId ??
      (await startSession({ api, dispatch, folderId: newSessionFolderId ?? null, setError }));
    if (sessionId === undefined) return;
    const run = await api.startAgent(sessionId, text, options.thinking);
    started = true;
    dispatch({ type: "agent.started", run });
    setSubmitting(false);
    try {
      dispatch({
        type: "messages.load",
        sessionId,
        messages: await retryLocalRequest(() => api.listMessages(sessionId)),
      });
    } catch {
      // The persisted user message is restored with the terminal refresh below.
    }
    await waitForAgentRun({
      runId: run.id,
      read: api.getAgentRun,
      onSnapshot: (snapshot) => dispatch({ type: "agent.snapshot", snapshot }),
    });
    try {
      dispatch({
        type: "messages.load",
        sessionId,
        messages: await retryLocalRequest(() => api.listMessages(sessionId)),
      });
    } catch {
      setError(t("error.responseRestore"));
    }
  } catch {
    setError(started ? t("error.statusRefresh") : t("error.taskStart"));
  } finally {
    setSubmitting(false);
  }
}

interface AttachOptions {
  api: DesktopApi;
  activeSessionId: string | undefined;
  newSessionFolderId: string | null | undefined;
  dispatch: Dispatch;
  draft: string;
  setError: SetError;
}

export async function attach(options: AttachOptions) {
  const { api, activeSessionId, newSessionFolderId, dispatch, draft, setError } = options;
  const sessionId =
    activeSessionId ??
    (await startSession({ api, dispatch, draft, folderId: newSessionFolderId ?? null, setError }));
  if (sessionId === undefined) return;
  try {
    await retryLocalRequest(() => api.saveDraft(sessionId, draft));
    const attachments = await api.chooseFiles(sessionId);
    if (attachments.length > 0) dispatch({ type: "attachments.add", attachments });
  } catch {
    setError(t("error.attach"));
  }
}

export async function attachDroppedFiles(options: AttachOptions & { paths: string[] }) {
  const { api, activeSessionId, newSessionFolderId, dispatch, draft, setError, paths } = options;
  const sessionId =
    activeSessionId ??
    (await startSession({ api, dispatch, draft, folderId: newSessionFolderId ?? null, setError }));
  if (sessionId === undefined) return;
  try {
    await retryLocalRequest(() => api.saveDraft(sessionId, draft));
    const attachments = await api.addFiles(sessionId, paths);
    if (attachments.length > 0) dispatch({ type: "attachments.add", attachments });
  } catch {
    setError(t("error.dropAttach"));
  }
}

export async function openAttachment(
  api: DesktopApi,
  sessionId: string,
  attachmentId: string,
  setError: SetError,
) {
  const failure = t("error.attachmentOpen");
  await openWithError(() => api.openAttachment(sessionId, attachmentId), setError, failure);
}

interface RemoveOptions {
  api: DesktopApi;
  sessionId: string;
  attachmentId: string;
  dispatch: Dispatch;
  setError: SetError;
}

export async function remove(options: RemoveOptions) {
  const { api, sessionId, attachmentId, dispatch, setError } = options;
  setError(undefined);
  try {
    if (await api.removeAttachment(sessionId, attachmentId)) {
      dispatch({ type: "attachment.remove", attachmentId });
    }
  } catch {
    setError(t("error.attachmentRemove"));
  }
}
