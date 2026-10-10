import { LawJurisdictionSummarySchema } from "@gardendesk/shared";
import type { DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";
import { record } from "./tauri-parse.js";

export const tauriLawApi: Pick<DesktopApi, "listLaws" | "setLawEnabled"> = {
  async listLaws() {
    return invokeDesktop("list_laws", (value) => LawJurisdictionSummarySchema.array().parse(value));
  },
  async setLawEnabled(id, enabled) {
    return invokeDesktop("set_law_enabled", (value) => record(value).changed === true, {
      id,
      enabled,
    });
  },
};
