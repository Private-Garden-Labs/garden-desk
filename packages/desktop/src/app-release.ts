import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";

export async function showReleasePage(
  api: DesktopApi,
  setError: (message: string | undefined) => void,
) {
  setError(undefined);
  try {
    await api.openReleasePage();
  } catch {
    setError(t("error.releasesPage"));
  }
}
