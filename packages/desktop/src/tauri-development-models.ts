import { DevelopmentModelSchema, DevelopmentModelSettingsSchema } from "@gardendesk/shared";
import type { DevelopmentModelApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";

export const tauriDevelopmentModelApi: DevelopmentModelApi = {
  async settings() {
    return invokeDesktop("development_model_settings", (value) =>
      DevelopmentModelSettingsSchema.parse(value),
    );
  },
  async search(query, apiKey) {
    return invokeDesktop(
      "development_model_search",
      (value) => DevelopmentModelSchema.array().parse(value),
      { query, ...(apiKey === undefined ? {} : { apiKey }) },
    );
  },
  async save(favorites, apiKey) {
    return invokeDesktop(
      "development_model_save",
      (value) => DevelopmentModelSettingsSchema.parse(value),
      { favorites, ...(apiKey === undefined ? {} : { apiKey }) },
    );
  },
};
