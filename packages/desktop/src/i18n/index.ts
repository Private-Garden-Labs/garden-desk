/// <reference types="vite/client" />
import { useSyncExternalStore } from "react";
import en from "./locales/en.json";
import { isLocaleCode, type LocaleCode, resolveLocale, rightToLeft } from "./locales.js";

export type TranslationKey = keyof typeof en;
type PluralBase<K> = K extends `${infer Base}_other` ? Base : never;
type Messages = Partial<Record<string, string>>;

const STORAGE_KEY = "gardendesk.locale";
const loaders = import.meta.glob<{ default: Messages }>(["./locales/*.json", "!./locales/en.json"]);
const listeners = new Set<() => void>();
const english: Messages = en;
let locale: LocaleCode = "en";
let messages: Messages = english;
let plurals = new Intl.PluralRules(locale);

function storedLocale(): LocaleCode | undefined {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLocaleCode(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

async function apply(next: LocaleCode): Promise<void> {
  const load = loaders[`./locales/${next}.json`];
  messages = load === undefined ? english : (await load()).default;
  locale = next;
  plurals = new Intl.PluralRules(next);
  document.documentElement.lang = next;
  document.documentElement.dir = rightToLeft.includes(next) ? "rtl" : "ltr";
  for (const listener of listeners) listener();
}

export async function initLocale(): Promise<void> {
  await apply(storedLocale() ?? resolveLocale(navigator.languages));
}

export async function setLocale(next: LocaleCode): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  await apply(next);
}

export function useLocale(): LocaleCode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => locale,
    () => locale,
  );
}

export function currentLocale(): LocaleCode {
  return locale;
}

export function t(
  key: TranslationKey | PluralBase<TranslationKey>,
  values: Record<string, string | number> = {},
): string {
  const count = values.count;
  const rule = typeof count === "number" ? plurals.select(count) : "other";
  const template =
    messages[`${key}_${rule}`] ??
    messages[`${key}_other`] ??
    messages[key] ??
    english[`${key}_other`] ??
    english[key] ??
    key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    return typeof value === "number" ? value.toLocaleString(locale) : (value ?? `{${name}}`);
  });
}
