import type { DesktopApi } from "./api.js";

export async function showReleasePage(
  api: DesktopApi,
  setError: (message: string | undefined) => void,
) {
  setError(undefined);
  try {
    await api.openReleasePage();
  } catch {
    setError("The releases page could not be opened.");
  }
}
