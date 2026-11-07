import type {
  AuditEventInput,
  DevelopmentModel,
  DevelopmentModelSettings,
} from "@gardendesk/shared";
import type { InferenceService } from "../runtime/inference.js";
import { providerPriceBudget, searchOpenRouterModels } from "./openrouter-client.js";
import { contextBudgetTokens } from "./openrouter-messages.js";
import { OpenRouterRuntime } from "./openrouter-runtime.js";
import { DevelopmentSettingsStore, developmentSettingsView } from "./openrouter-settings.js";

export interface DevelopmentInferenceSelection {
  modelId: string;
  contextTokens: number;
  chat: InferenceService["chat"];
}

export interface DevelopmentModelSaveInput {
  favorites: DevelopmentModel[];
  apiKey?: string;
}

export interface DevelopmentPorts {
  modelSettings(): Promise<DevelopmentModelSettings>;
  searchModels(query: string, apiKey?: string): Promise<DevelopmentModel[]>;
  saveModelSettings(input: DevelopmentModelSaveInput): Promise<DevelopmentModelSettings>;
  fixModelSelection(modelId: string): Promise<DevelopmentInferenceSelection>;
}

type AuditAppender = (event: AuditEventInput) => void;

export function createDevelopmentPorts(
  stateDirectory: string,
  audit: AuditAppender,
): DevelopmentPorts {
  const store = new DevelopmentSettingsStore(stateDirectory);
  return {
    async modelSettings() {
      return developmentSettingsView(await store.read());
    },
    async searchModels(query, apiKey) {
      const search = query.trim();
      if (search.length === 0) return [];
      const key = apiKey ?? (await store.read()).apiKey;
      if (key === undefined) throw new Error("development_model_key_missing");
      return await searchOpenRouterModels({ apiKey: key, query: search });
    },
    async saveModelSettings(input) {
      const current = await store.read();
      const apiKey = input.apiKey ?? current.apiKey;
      const settings = {
        favorites: input.favorites,
        ...(apiKey === undefined ? {} : { apiKey }),
      };
      await store.write(settings);
      audit({
        type: "development.model_settings_saved",
        outcome: "succeeded",
        metadata: { favorites: input.favorites.length, keyReplaced: input.apiKey !== undefined },
      });
      return developmentSettingsView(settings);
    },
    async fixModelSelection(modelId) {
      const settings = await store.read();
      const model = settings.favorites.find((favorite) => favorite.id === modelId);
      if (model === undefined) throw new Error("development_model_unavailable");
      if (settings.apiKey === undefined) throw new Error("development_model_key_missing");
      const budget = await providerPriceBudget({ apiKey: settings.apiKey, modelId: model.id });
      const runtime = new OpenRouterRuntime({
        model,
        apiKey: settings.apiKey,
        audit,
        ...(budget === undefined ? {} : { budget }),
      });
      return {
        modelId: model.id,
        contextTokens: contextBudgetTokens(model),
        chat: (input, signal, streams, identity) => runtime.chat(input, signal, streams, identity),
      };
    },
  };
}
