import type { SessionSummary } from "@gardendesk/shared";
import type { FolderGroup } from "../state.js";
import { Icon } from "./icons.js";
import { SidebarItemRow } from "./sidebar-item-row.js";

interface SessionListProps {
  activeSessionId: string | undefined;
  disabled: boolean;
  folder: FolderGroup;
  workingSessionIds: string[];
  nativeActionMessage?: string | undefined;
  onNewSession(folderId: string | null): void;
  onDeleteSession(session: SessionSummary): void;
  onSelectSession(sessionId: string): void;
  onShowMore(folderId: string): void;
  onShowLess(folderId: string): void;
}

interface GlobalSessionListProps {
  activeSessionId: string | undefined;
  disabled: boolean;
  globalSessions: SessionSummary[];
  globalNextCursor: string | null;
  workingSessionIds: string[];
  nativeActionMessage?: string | undefined;
  onDeleteSession(session: SessionSummary): void;
  onSelectSession(sessionId: string): void;
  onShowMore(folderId: string | null): void;
  onShowLess(folderId: string | null): void;
}

function SessionPageControls(props: {
  disabled: boolean;
  hasMore: boolean;
  expanded: boolean;
  onShowMore(): void;
  onShowLess(): void;
}) {
  if (!props.hasMore && !props.expanded) return null;
  return (
    <div className="session-page-controls">
      {props.hasMore ? (
        <button
          className="show-more"
          disabled={props.disabled}
          onClick={props.onShowMore}
          type="button"
        >
          Show more
        </button>
      ) : null}
      {props.expanded ? (
        <button
          aria-label="Show less"
          className="show-less"
          disabled={props.disabled}
          onClick={props.onShowLess}
          title="Show less"
          type="button"
        >
          <Icon name="chevron-up" />
        </button>
      ) : null}
    </div>
  );
}

export function GlobalSessionList(props: GlobalSessionListProps) {
  return (
    <div className="session-list global-session-list">
      {props.globalSessions.map((session) => (
        <SidebarItemRow
          active={session.id === props.activeSessionId}
          deleteLabel={`Delete ${session.title}`}
          disabled={props.disabled}
          key={session.id}
          label={session.title}
          working={props.workingSessionIds.includes(session.id)}
          nativeActionMessage={props.nativeActionMessage}
          onDelete={() => props.onDeleteSession(session)}
          onSelect={() => props.onSelectSession(session.id)}
        />
      ))}
      <SessionPageControls
        disabled={props.disabled}
        hasMore={props.globalNextCursor !== null}
        expanded={props.globalSessions.length > 5}
        onShowMore={() => props.onShowMore(null)}
        onShowLess={() => props.onShowLess(null)}
      />
    </div>
  );
}

export function SessionList(props: SessionListProps) {
  return (
    <div className="session-list">
      <button
        className="new-folder-session"
        disabled={props.disabled}
        onClick={() => props.onNewSession(props.folder.id)}
        type="button"
      >
        <Icon name="message" />
        New conversation
      </button>
      {props.folder.sessions.map((session) => (
        <SidebarItemRow
          active={session.id === props.activeSessionId}
          deleteLabel={`Delete ${session.title}`}
          disabled={props.disabled}
          key={session.id}
          label={session.title}
          working={props.workingSessionIds.includes(session.id)}
          nativeActionMessage={props.nativeActionMessage}
          onDelete={() => props.onDeleteSession(session)}
          onSelect={() => props.onSelectSession(session.id)}
        />
      ))}
      <SessionPageControls
        disabled={props.disabled}
        hasMore={props.folder.nextCursor !== null}
        expanded={props.folder.sessions.length > 5}
        onShowMore={() => props.onShowMore(props.folder.id)}
        onShowLess={() => props.onShowLess(props.folder.id)}
      />
    </div>
  );
}
