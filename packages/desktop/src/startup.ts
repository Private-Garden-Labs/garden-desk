import type { ModelRuntimeStatus } from "@gardendesk/shared";
import { type Dispatch, useEffect, useRef } from "react";
import type { DesktopApi, DesktopBootstrap } from "./api.js";
import { selectSession } from "./desktop-actions.js";
import type { DesktopAction } from "./state.js";

export interface DesktopBootstrapRequest {
  api: DesktopApi;
  promise: Promise<DesktopBootstrap>;
}

export function desktopBootstrapRequest(
  api: DesktopApi,
  current?: DesktopBootstrapRequest,
): DesktopBootstrapRequest {
  return current?.api === api ? current : { api, promise: api.bootstrapDesktop() };
}

interface DesktopBootstrapOptions {
  api: DesktopApi;
  dispatch: Dispatch<DesktopAction>;
  setAppVersion(version: string | undefined): void;
  setError(message: string | undefined): void;
  setModel(model: ModelRuntimeStatus): void;
}

export function useDesktopBootstrap(options: DesktopBootstrapOptions) {
  const { api, dispatch, setAppVersion, setError, setModel } = options;
  const request = useRef<DesktopBootstrapRequest | undefined>(undefined);
  useEffect(() => {
    request.current = desktopBootstrapRequest(api, request.current);
    let active = true;
    void request.current.promise
      .then((snapshot) => {
        if (!active) return;
        setModel(snapshot.model);
        setAppVersion(snapshot.appVersion);
        if (snapshot.model.state === "unsupported" && snapshot.model.message !== undefined)
          setError(snapshot.model.message);
        dispatch({ type: "desktop.hydrate", snapshot });
        if (snapshot.initialSessionId !== undefined) {
          void selectSession(api, snapshot.initialSessionId, dispatch, setError);
        }
      })
      .catch(() => {
        if (active) setError("Garden Desk could not finish loading.");
      });
    return () => {
      active = false;
    };
  }, [api, dispatch, setAppVersion, setError, setModel]);
}
