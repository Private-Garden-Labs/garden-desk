export interface DebugSnapshotState {
  creating: boolean;
  error: string | undefined;
  path: string | undefined;
  revealing: boolean;
}

export type DebugSnapshotAction =
  | { type: "session.reset" }
  | { type: "create.start" }
  | { type: "create.succeeded"; path: string }
  | { type: "create.failed"; code: string }
  | { type: "reveal.start" }
  | { type: "reveal.succeeded" }
  | { type: "reveal.failed"; code: string };

export const initialDebugSnapshotState: DebugSnapshotState = {
  creating: false,
  error: undefined,
  path: undefined,
  revealing: false,
};

export function debugSnapshotReducer(
  state: DebugSnapshotState,
  action: DebugSnapshotAction,
): DebugSnapshotState {
  if (action.type === "session.reset") return initialDebugSnapshotState;
  if (action.type === "create.start") {
    return { creating: true, error: undefined, path: undefined, revealing: false };
  }
  if (action.type === "create.succeeded") {
    return { creating: false, error: undefined, path: action.path, revealing: false };
  }
  if (action.type === "create.failed") {
    return {
      creating: false,
      error: `Could not save the debug snapshot. Code: ${action.code}`,
      path: undefined,
      revealing: false,
    };
  }
  if (action.type === "reveal.start") return { ...state, error: undefined, revealing: true };
  if (action.type === "reveal.succeeded") return { ...state, revealing: false };
  return {
    ...state,
    error: `Could not show the debug snapshot. Code: ${action.code}`,
    revealing: false,
  };
}
