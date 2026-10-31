import { currentLocale, type TranslationKey, t } from "./i18n/index.js";
import en from "./i18n/locales/en.json";

function englishPattern(template: string): RegExp {
  const escaped = template.replaceAll(/[.*+?^$()|[\]\\]/gu, "\\$&");
  return new RegExp(`^${escaped.replaceAll(/\{(\w+)\}/gu, "(?<$1>.+)")}$`, "su");
}

const stepPatterns = (Object.keys(en) as TranslationKey[])
  .filter((key) => key.startsWith("step."))
  .map((key) => ({ key, pattern: englishPattern(en[key]) }));

const titles = new Map<string, string>();
let titlesLocale = currentLocale();

function translatedTitle(text: string): string {
  for (const { key, pattern } of stepPatterns) {
    const match = pattern.exec(text);
    if (match === null) continue;
    const values = { ...match.groups };
    if (values.step !== undefined) values.step = translatedTitle(values.step);
    return t(key, values);
  }
  return text;
}

/** Core writes step titles in English; the `step.*` English messages match them in order. */
export function stepTitle(text: string): string {
  if (titlesLocale !== currentLocale()) {
    titles.clear();
    titlesLocale = currentLocale();
  }
  const cached = titles.get(text);
  if (cached !== undefined) return cached;
  const title = translatedTitle(text);
  titles.set(text, title);
  return title;
}
