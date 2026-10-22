import { type TranslationKey, t } from "./i18n/index.js";
import en from "./i18n/locales/en.json";

function englishPattern(template: string): RegExp {
  const escaped = template.replaceAll(/[.*+?^$()|[\]\\]/gu, "\\$&");
  return new RegExp(`^${escaped.replaceAll(/\{(\w+)\}/gu, "(?<$1>.+)")}$`, "su");
}

const stepPatterns = (Object.keys(en) as TranslationKey[])
  .filter((key) => key.startsWith("step."))
  .map((key) => ({ key, pattern: englishPattern(en[key]) }));

/** Core writes step titles in English; the `step.*` English messages match them in order. */
export function stepTitle(text: string): string {
  for (const { key, pattern } of stepPatterns) {
    const match = pattern.exec(text);
    if (match === null) continue;
    const values = { ...match.groups };
    if (values.step !== undefined) values.step = stepTitle(values.step);
    return t(key, values);
  }
  return text;
}
