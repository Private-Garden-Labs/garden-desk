import {
  CompanyPacksSchema,
  DataPacksSchema,
  LawActSchema,
  LawCitationsSchema,
  LawJurisdictionSummarySchema,
} from "@gardendesk/shared";
import type { DataPackKeyStatus, DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";
import { record } from "./tauri-parse.js";

const keyStatuses: DataPackKeyStatus[] = ["accepted", "rejected", "offline"];

export const tauriLawApi: Pick<
  DesktopApi,
  | "listLaws"
  | "readLaw"
  | "listLawCitations"
  | "openLawSource"
  | "setLawEnabled"
  | "listDataPacks"
  | "saveDataPackKey"
  | "installDataPack"
  | "companyPacks"
  | "chooseCompanyPack"
  | "importCompanyPack"
  | "chooseCompanyPackFolder"
  | "buildCompanyPack"
> = {
  async listLaws() {
    return invokeDesktop("list_laws", (value) => LawJurisdictionSummarySchema.array().parse(value));
  },
  async readLaw(id, source) {
    return invokeDesktop("read_law", (value) => LawActSchema.parse(value), { id, source });
  },
  async listLawCitations() {
    return invokeDesktop("list_law_citations", (value) => LawCitationsSchema.parse(value));
  },
  async openLawSource(id, source) {
    await invokeDesktop("open_law_source", () => undefined, { id, source });
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
  async companyPacks() {
    return invokeDesktop("company_packs", (value) => CompanyPacksSchema.parse(value));
  },
  async chooseCompanyPack() {
    return invokeDesktop("choose_company_pack", (value) =>
      typeof value === "string" ? value : undefined,
    );
  },
  async importCompanyPack(path, trust) {
    return invokeDesktop("import_company_pack", (value) => record(value).started === true, {
      path,
      trust: trust ?? null,
    });
  },
  async chooseCompanyPackFolder() {
    await invokeDesktop("choose_company_pack_folder", () => undefined);
  },
  async buildCompanyPack(name, id, publisher) {
    await invokeDesktop("build_company_pack", () => undefined, { name, id, publisher });
  },
};
