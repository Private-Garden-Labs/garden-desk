import { DataPacksSchema, LawJurisdictionSummarySchema } from "@gardendesk/shared";
import type { DataPackKeyStatus, DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";
import { record } from "./tauri-parse.js";

const keyStatuses: DataPackKeyStatus[] = ["accepted", "rejected", "offline"];

export const tauriLawApi: Pick<
  DesktopApi,
  "listLaws" | "setLawEnabled" | "listDataPacks" | "saveDataPackKey" | "installDataPack"
> = {
  async listLaws() {
    return invokeDesktop("list_laws", (value) => LawJurisdictionSummarySchema.array().parse(value));
  },
  async setLawEnabled(id, enabled, source) {
    return invokeDesktop("set_law_enabled", (value) => record(value).changed === true, {
      id,
      enabled,
      source: source ?? null,
    });
  },
  async listDataPacks() {
    return invokeDesktop("list_data_packs", (value) => DataPacksSchema.parse(value));
  },
  async saveDataPackKey(key) {
    return invokeDesktop(
      "save_data_pack_key",
      (value) => keyStatuses.find((status) => status === record(value).status) ?? "rejected",
      { key },
    );
  },
  async installDataPack(id) {
    return invokeDesktop("install_data_pack", (value) => record(value).started === true, { id });
  },
};
