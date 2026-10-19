const storageKey = "gardendesk.locale";

const languages = [
  ["en", "English (US)"],
  ["cs", "čeština"],
  ["da", "dansk"],
  ["de", "Deutsch (DE)"],
  ["es-419", "español (Latinoamérica)"],
  ["es-ES", "español (España)"],
  ["fil", "Filipino"],
  ["fr", "français (FR)"],
  ["id", "Indonesia"],
  ["it", "italiano (IT)"],
  ["ms", "Melayu"],
  ["nl", "Nederlands (NL)"],
  ["nb", "norsk bokmål (NO)"],
  ["pl", "polski"],
  ["pt-BR", "português (BR)"],
  ["ro", "română"],
  ["fi", "suomi"],
  ["sv", "svenska"],
  ["tr", "Türkçe"],
  ["he", "עברית"],
  ["ar", "العربية (SA)"],
  ["fa", "فارسی"],
  ["hi", "हिन्दी"],
  ["bn", "বাংলা"],
  ["th", "ไทย"],
  ["ko", "한국어"],
  ["zh-CN", "中文 (CN)"],
  ["ja", "日本語"],
] as const;

const codes: readonly string[] = languages.map(([code]) => code);
const rightToLeft = new Set(["he", "ar", "fa"]);
const regionalDefaults: Record<string, string> = {
  es: "es-419",
  pt: "pt-BR",
  zh: "zh-CN",
  no: "nb",
  nn: "nb",
  tl: "fil",
};
const files = import.meta.glob<Record<string, string>>("../locales/*.json", { import: "default" });

interface Slot {
  key: string;
  english: string;
  write: (value: string) => void;
}

export function resolveLocale(preferred: readonly string[]): string {
  for (const tag of preferred) {
    const exact = codes.find((code) => code.toLowerCase() === tag.toLowerCase());
    const base = tag.split("-")[0]?.toLowerCase() ?? "";
    const match = exact ?? regionalDefaults[base] ?? codes.find((code) => code === base);
    if (match !== undefined) return match;
  }
  return "en";
}

function savedLocale(): string | undefined {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved !== null && codes.includes(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

function saveLocale(code: string): void {
  try {
    localStorage.setItem(storageKey, code);
  } catch {
    return;
  }
}

function mountSelect(): HTMLSelectElement | undefined {
  const host = document.querySelector<HTMLElement>(".site-nav, [data-language-host]");
  if (host === null) return undefined;
  const select = document.createElement("select");
  select.className = "language-select";
  select.setAttribute("aria-label", "Language");
  select.dataset.i18nAttr = "aria-label=language";
  for (const [code, label] of languages) select.append(new Option(label, code));
  host.insertBefore(select, host.querySelector(".nav-button"));
  return select;
}

function collectSlots(): Slot[] {
  const slots: Slot[] = [];
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    slots.push({
      key: element.dataset.i18n ?? "",
      english: element.textContent ?? "",
      write: (value) => {
        element.textContent = value;
      },
    });
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-html]")) {
    slots.push({
      key: element.dataset.i18nHtml ?? "",
      english: element.innerHTML,
      write: (value) => {
        element.innerHTML = value;
      },
    });
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-attr]")) {
    const [attribute = "", key = ""] = (element.dataset.i18nAttr ?? "").split("=");
    slots.push({
      key,
      english: element.getAttribute(attribute) ?? "",
      write: (value) => element.setAttribute(attribute, value),
    });
  }
  return slots;
}

const select = mountSelect();
const slots = collectSlots();

async function apply(code: string): Promise<void> {
  const load = files[`../locales/${code}.json`];
  const strings = load === undefined ? {} : await load();
  document.documentElement.lang = code;
  document.documentElement.dir = rightToLeft.has(code) ? "rtl" : "ltr";
  for (const slot of slots) slot.write(strings[slot.key] ?? slot.english);
}

const initial = savedLocale() ?? resolveLocale(navigator.languages);
if (select !== undefined) {
  select.value = initial;
  select.addEventListener("change", () => {
    saveLocale(select.value);
    void apply(select.value);
  });
}
if (initial !== "en") void apply(initial);
