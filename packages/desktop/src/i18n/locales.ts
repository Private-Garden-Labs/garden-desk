export const localeOptions = [
  { code: "en", label: "English (US)" },
  { code: "cs", label: "Čeština" },
  { code: "da", label: "Dansk" },
  { code: "de", label: "Deutsch (DE)" },
  { code: "es-419", label: "Español (Latinoamérica)" },
  { code: "es-ES", label: "Español (España)" },
  { code: "fil", label: "Filipino" },
  { code: "fr", label: "Français (FR)" },
  { code: "id", label: "Indonesia" },
  { code: "it", label: "Italiano (IT)" },
  { code: "ms", label: "Melayu" },
  { code: "nl", label: "Nederlands (NL)" },
  { code: "nb", label: "Norsk bokmål (NO)" },
  { code: "pl", label: "Polski" },
  { code: "pt-BR", label: "Português (BR)" },
  { code: "ro", label: "Română" },
  { code: "fi", label: "Suomi" },
  { code: "sv", label: "Svenska" },
  { code: "tr", label: "Türkçe" },
  { code: "he", label: "עברית" },
  { code: "ar", label: "العربية (SA)" },
  { code: "fa", label: "فارسی" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "th", label: "ไทย" },
  { code: "ko", label: "한국어" },
  { code: "zh-CN", label: "中文 (CN)" },
  { code: "ja", label: "日本語" },
] as const;

export type LocaleCode = (typeof localeOptions)[number]["code"];

export const rightToLeft: readonly LocaleCode[] = ["he", "ar", "fa"];

const baseLanguages: Record<string, LocaleCode> = {
  es: "es-419",
  pt: "pt-BR",
  zh: "zh-CN",
  no: "nb",
  nn: "nb",
  tl: "fil",
};

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return localeOptions.some((option) => option.code === value);
}

function findCode(lower: string): LocaleCode | undefined {
  return localeOptions.find((option) => option.code.toLowerCase() === lower)?.code;
}

function matchTag(tag: string): LocaleCode | undefined {
  const lower = tag.toLowerCase();
  const base = lower.split("-")[0] ?? lower;
  return findCode(lower) ?? baseLanguages[base] ?? findCode(base);
}

export function resolveLocale(languages: readonly string[]): LocaleCode {
  for (const tag of languages) {
    const match = matchTag(tag);
    if (match !== undefined) return match;
  }
  return "en";
}
