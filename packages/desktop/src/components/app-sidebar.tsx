import type { DesktopApi } from "../api.js";
import { showReleasePage } from "../app-release.js";
import { deleteSessionConfirmation, revokeFolderConfirmation } from "../confirmations.js";
import {
  addFolder,
  reorderFolders,
  selectSession,
  showFolder,
  showLess,
  showMore,
} from "../desktop-actions.js";
import type { DropIntent } from "../desktop-drop.js";
import type { DesktopAction, DesktopState } from "../state.js";
import type { ConfirmationRequest } from "./confirmation.js";
import { Sidebar } from "./sidebar.js";

export type SettingsPage = "skills" | "laws";

interface AppSidebarProps {
  api: DesktopApi;
  appVersion: string | undefined;
  dispatch(action: DesktopAction): void;
  dropIntent: DropIntent | undefined;
  nativeActionMessage: string | undefined;
  onSettingsPageChange(page: SettingsPage | undefined): void;
  setConfirmation(request: ConfirmationRequest): void;
  setError(message: string | undefined): void;
  settingsPage: SettingsPage | undefined;
  state: DesktopState;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one sidebar wiring boundary; its actions live in desktop-actions and confirmations.
export function AppSidebar({
  api,
  appVersion,
  dispatch,
  dropIntent,
  nativeActionMessage,
  onSettingsPageChange,
  setConfirmation,
  setError,
  settingsPage,
  state,
}: AppSidebarProps) {
  return (
    <Sidebar
      activeSessionId={state.activeSessionId}
      appVersion={appVersion}
      disabled={!state.loaded}
      dropActive={dropIntent === "folders" || dropIntent === "mixed"}
      dispatch={dispatch}
      folders={state.folders}
      globalSessions={state.globalSessions}
      globalNextCursor={state.globalNextCursor}
      workingSessionIds={state.workingSessionIds}
      nativeActionMessage={nativeActionMessage}
      onAddFolder={() => void addFolder(api, dispatch, setError)}
      onNewSession={(folderId) => {
        onSettingsPageChange(undefined);
        dispatch({ type: "session.new", folderId });
      }}
      onOpenFolder={(folderId) => void showFolder(api, folderId, setError)}
      onOpenReleases={() => void showReleasePage(api, setError)}
      onOpenLaws={() => onSettingsPageChange("laws")}
      onOpenSkills={() => onSettingsPageChange("skills")}
      onDeleteSession={(session) =>
        setConfirmation(
          deleteSessionConfirmation({
            api,
            dispatch,
            session,
            visibleCount:
              session.folderId === null
                ? state.globalSessions.length
                : (state.folders.find((folder) => folder.id === session.folderId)?.sessions
                    .length ?? 0),
            setError: setError,
          }),
        )
      }
      onRevokeFolder={(folderId) =>
        setConfirmation(
          revokeFolderConfirmation({
            api,
            dispatch,
            folderId,
            folderName: state.folders.find((folder) => folder.id === folderId)?.name,
            setError: setError,
          }),
        )
      }
      onReorderFolders={(folderIds) => void reorderFolders(api, folderIds, dispatch, setError)}
      onSelectSession={(sessionId) => {
        onSettingsPageChange(undefined);
        void selectSession(api, sessionId, dispatch, setError);
      }}
      settingsActive={settingsPage !== undefined}
      onShowMore={(folderId) =>
        void showMore({
          api,
          folderId,
          cursor:
            folderId === null
              ? state.globalNextCursor
              : (state.folders.find((folder) => folder.id === folderId)?.nextCursor ?? null),
          dispatch,
          setError: setError,
        })
      }
      onShowLess={(folderId) => void showLess({ api, folderId, dispatch, setError })}
    />
  );
}
