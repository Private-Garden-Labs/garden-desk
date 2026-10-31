import type { Jurisdiction, LawJurisdictionSummary } from "@gardendesk/shared";
import { type TranslationKey, t } from "./i18n/index.js";

const names = {
  us: "laws.name.us",
  eu: "laws.name.eu",
} as const satisfies Record<Jurisdiction, TranslationKey>;

export function lawName(law: LawJurisdictionSummary): string {
  return t(names[law.id]);
}
