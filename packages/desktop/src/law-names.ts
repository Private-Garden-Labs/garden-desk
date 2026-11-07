import type { LawJurisdictionSummary } from "@gardendesk/shared";
import { type TranslationKey, t } from "./i18n/index.js";

const names: Partial<Record<string, TranslationKey>> = {
  us: "laws.name.us",
  eu: "laws.name.eu",
  ro: "laws.name.ro",
};

export function lawName(law: Pick<LawJurisdictionSummary, "id" | "name">): string {
  const key = names[law.id];
  return key === undefined ? law.name : t(key);
}
