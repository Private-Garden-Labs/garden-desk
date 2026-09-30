import { useReducer } from "react";
import type { DesktopApi } from "../api.js";
import {
  type DebugSnapshotState,
  debugSnapshotReducer,
  initialDebugSnapshotState,
} from "../debug-snapshot.js";
import { desktopPlatform } from "../platform.js";
import { splitPath } from "./technical-overview-table.js";

function SnapshotPath({ path }: { path: string }) {
  const parts = splitPath(path);
  return (
    <span className="debug-snapshot-path" title={path}>
      {parts === undefined ? (
        path
      ) : (
        <>
          <span className="technical-path-parent">{parts[0]}</span>
          <span className="technical-path-name">{parts[1]}</span>
        </>
      )}
    </span>
  );
}

function errorCode(error: unknown): string {
  return typeof error === "string" ? error : "unknown";
}

export function DebugSnapshotPanel({
  onCreate,
  onReveal,
  state,
}: {
  onCreate(): void;
  onReveal(): void;
  state: DebugSnapshotState;
}) {
  return (
    <div className="debug-snapshot-controls">
      <button disabled={state.creating || state.revealing} onClick={onCreate} type="button">
        {state.creating ? "Saving snapshot…" : "Save debug snapshot"}
      </button>
      {state.path === undefined ? null : (
        <div className="debug-snapshot-result">
          <p>
            Saved. <SnapshotPath path={state.path} />
          </p>
          <button disabled={state.revealing} onClick={onReveal} type="button">
            {desktopPlatform(navigator.userAgent) === "windows"
              ? "Show in Explorer"
              : "Show in Finder"}
          </button>
        </div>
      )}
      {state.error === undefined ? null : <p role="alert">{state.error}</p>}
    </div>
  );
}

export function DebugSnapshotControls({
  api,
  nativeActionMessage,
  sessionId,
}: {
  api: DesktopApi;
  nativeActionMessage?: string | undefined;
  sessionId: string;
}) {
  const [state, dispatch] = useReducer(debugSnapshotReducer, initialDebugSnapshotState);
  const create = async () => {
    dispatch({ type: "create.start" });
    try {
      dispatch({ type: "create.succeeded", path: await api.createDebugSnapshot(sessionId) });
    } catch (error) {
      dispatch({ type: "create.failed", code: errorCode(error) });
    }
  };
  const reveal = async () => {
    dispatch({ type: "reveal.start" });
    try {
      await api.revealDebugSnapshot(sessionId);
      dispatch({ type: "reveal.succeeded" });
    } catch (error) {
      dispatch({ type: "reveal.failed", code: errorCode(error) });
    }
  };
  if (nativeActionMessage !== undefined) {
    return (
      <div className="debug-snapshot-controls">
        <button disabled title={nativeActionMessage} type="button">
          Save debug snapshot
        </button>
        <p>{nativeActionMessage}</p>
      </div>
    );
  }
  return (
    <DebugSnapshotPanel
      onCreate={() => void create()}
      onReveal={() => void reveal()}
      state={state}
    />
  );
}
