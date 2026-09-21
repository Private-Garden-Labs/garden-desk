import type { ConversationMessage, SessionSummary } from "@gardendesk/shared";
import { applyAgentSnapshot } from "./agent-state.js";
import type { DesktopAction, DesktopState } from "./state.js";
import { emptyConversation } from "./state-initial.js";

export function activeSessionTitle(state: DesktopState): string | undefined {
  return [...state.globalSessions, ...state.folders.flatMap((folder) => folder.sessions)].find(
    (session) => session.id === state.activeSessionId,
  )?.title;
}

export function renameSession(
  state: DesktopState,
  action: { sessionId: string; title: string },
): DesktopState {
  const renamed = (session: SessionSummary) =>
    session.id === action.sessionId ? { ...session, title: action.title } : session;
  return {
    ...state,
    globalSessions: state.globalSessions.map(renamed),
    folders: state.folders.map((folder) => ({
      ...folder,
      sessions: folder.sessions.map(renamed),
    })),
  };
}

export function deleteSession(state: DesktopState, sessionId: string): DesktopState {
  const activeDeleted = state.activeSessionId === sessionId;
  return {
    ...state,
    globalSessions: state.globalSessions.filter((session) => session.id !== sessionId),
    folders: state.folders.map((folder) => ({
      ...folder,
      sessions: folder.sessions.filter((session) => session.id !== sessionId),
    })),
    workingSessionIds: state.workingSessionIds.filter((id) => id !== sessionId),
    thinkingBySession: Object.fromEntries(
      Object.entries(state.thinkingBySession).filter(([entry]) => entry !== sessionId),
    ),
    ...(activeDeleted ? emptyConversation(null) : {}),
    ...(state.pendingSessionId === sessionId ? { pendingSessionId: undefined } : {}),
  };
}

export function loadMessages(
  state: DesktopState,
  sessionId: string,
  messages: ConversationMessage[],
): DesktopState {
  if (state.activeSessionId !== sessionId) return state;
  const activity = state.timeline.filter((item) => item.kind === "activity");
  const interruptedRunIds = new Set(
    activity
      .filter((item) => item.eventType === "run.cancelled" || item.eventType === "run.failed")
      .map((item) => item.runId),
  );
  const title = messages
    .find((message) => message.role === "user")
    ?.content.replaceAll(/\s+/gu, " ")
    .slice(0, 60);
  return {
    ...state,
    timeline: [
      ...messages
        .filter((message) => !interruptedRunIds.has(message.runId))
        .map((message) => ({
          createdAt: message.createdAt,
          id: message.id,
          kind: message.role,
          text: message.content,
          runId: message.runId,
        })),
      ...activity,
    ],
    globalSessions: state.globalSessions.map((session) =>
      session.id === sessionId && session.title === "New chat" && title !== undefined
        ? { ...session, title }
        : session,
    ),
    folders: state.folders.map((folder) => ({
      ...folder,
      sessions: folder.sessions.map((session) =>
        session.id === sessionId && session.title === "New chat" && title !== undefined
          ? { ...session, title }
          : session,
      ),
    })),
  };
}

export function loadSession(
  state: DesktopState,
  action: Extract<DesktopAction, { type: "session.loaded" }>,
): DesktopState {
  if (state.pendingSessionId !== action.sessionId) return state;
  let loaded: DesktopState = {
    ...state,
    ...emptyConversation(undefined),
    activeSessionId: action.sessionId,
    attachments: action.attachments,
    removableAttachmentIds: action.removableIds,
    draft: action.draft,
  };
  for (const snapshot of action.snapshots) {
    loaded = applyAgentSnapshot(loaded, snapshot);
  }
  return loadMessages(loaded, action.sessionId, action.messages);
}
