import type { ModelRuntimeStatus } from "@gardendesk/shared";
import { INFERENCE_PROFILE } from "@gardendesk/shared";
import { useEffect } from "react";
import type { DesktopApi } from "./api.js";

export const initialModelStatus: ModelRuntimeStatus = {
  modelId: INFERENCE_PROFILE.modelId,
  name: INFERENCE_PROFILE.name,
  state: "unloaded",
  thinkingSupported: true,
};

export async function unloadModel(
  api: DesktopApi,
  setModel: (model: ModelRuntimeStatus) => void,
  setError: (message: string) => void,
) {
  try {
    const unloaded = await api.unloadModel();
    if (!unloaded) setError("The model is still in use and could not be unloaded.");
    setModel(await api.getModelStatus());
  } catch {
    setError("The model could not be unloaded.");
  }
}

export function useModelRefresh(
  api: DesktopApi,
  loaded: boolean,
  refreshing: boolean,
  setModel: (model: ModelRuntimeStatus) => void,
) {
  useEffect(() => {
    if (!loaded) return;
    const refresh = () =>
      void api
        .getModelStatus()
        .then(setModel)
        .catch(() => undefined);
    refresh();
    if (!refreshing) return;
    const timer = window.setInterval(refresh, 700);
    return () => window.clearInterval(timer);
  }, [api, loaded, refreshing, setModel]);
}
