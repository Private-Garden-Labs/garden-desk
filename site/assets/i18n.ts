import flag_bd from "flag-icons/flags/4x3/bd.svg?no-inline";
import flag_br from "flag-icons/flags/4x3/br.svg?no-inline";
import flag_cn from "flag-icons/flags/4x3/cn.svg?no-inline";
import flag_cz from "flag-icons/flags/4x3/cz.svg?no-inline";
import flag_de from "flag-icons/flags/4x3/de.svg?no-inline";
import flag_dk from "flag-icons/flags/4x3/dk.svg?no-inline";
import flag_es from "flag-icons/flags/4x3/es.svg?no-inline";
import flag_fi from "flag-icons/flags/4x3/fi.svg?no-inline";
import flag_fr from "flag-icons/flags/4x3/fr.svg?no-inline";
import flag_id from "flag-icons/flags/4x3/id.svg?no-inline";
import flag_il from "flag-icons/flags/4x3/il.svg?no-inline";
import flag_in from "flag-icons/flags/4x3/in.svg?no-inline";
import flag_ir from "flag-icons/flags/4x3/ir.svg?no-inline";
import flag_it from "flag-icons/flags/4x3/it.svg?no-inline";
import flag_jp from "flag-icons/flags/4x3/jp.svg?no-inline";
import flag_kr from "flag-icons/flags/4x3/kr.svg?no-inline";
import flag_my from "flag-icons/flags/4x3/my.svg?no-inline";
import flag_nl from "flag-icons/flags/4x3/nl.svg?no-inline";
import flag_no from "flag-icons/flags/4x3/no.svg?no-inline";
import flag_ph from "flag-icons/flags/4x3/ph.svg?no-inline";
import flag_pl from "flag-icons/flags/4x3/pl.svg?no-inline";
import flag_ro from "flag-icons/flags/4x3/ro.svg?no-inline";
import flag_sa from "flag-icons/flags/4x3/sa.svg?no-inline";
import flag_se from "flag-icons/flags/4x3/se.svg?no-inline";
import flag_th from "flag-icons/flags/4x3/th.svg?no-inline";
import flag_tr from "flag-icons/flags/4x3/tr.svg?no-inline";
import flag_us from "flag-icons/flags/4x3/us.svg?no-inline";

const storageKey = "gardendesk.locale";
const globeIcon =
  '<svg width="20" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

const languages = [
  ["en", "English (US)"],
  ["cs", "Čeština"],
  ["da", "Dansk"],
  ["de", "Deutsch (DE)"],
  ["es-419", "Español (Latinoamérica)"],
  ["es-ES", "Español (España)"],
  ["fil", "Filipino"],
  ["fr", "Français (FR)"],
  ["id", "Indonesia"],
  ["it", "Italiano (IT)"],
  ["ms", "Melayu"],
  ["nl", "Nederlands (NL)"],
  ["nb", "Norsk bokmål (NO)"],
  ["pl", "Polski"],
  ["pt-BR", "Português (BR)"],
  ["ro", "Română"],
  ["fi", "Suomi"],
  ["sv", "Svenska"],
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

const flags: Record<string, string> = {
  en: flag_us,
  cs: flag_cz,
  da: flag_dk,
  de: flag_de,
  "es-ES": flag_es,
  fil: flag_ph,
  fr: flag_fr,
  id: flag_id,
  it: flag_it,
  ms: flag_my,
  nl: flag_nl,
  nb: flag_no,
  pl: flag_pl,
  "pt-BR": flag_br,
  ro: flag_ro,
  fi: flag_fi,
  sv: flag_se,
  tr: flag_tr,
  he: flag_il,
  ar: flag_sa,
  fa: flag_ir,
  hi: flag_in,
  bn: flag_bd,
  th: flag_th,
  ko: flag_kr,
  "zh-CN": flag_cn,
  ja: flag_jp,
};

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

function linkedLocale(): string | undefined {
  const linked = new URLSearchParams(location.search).get("lang");
  return linked !== null && codes.includes(linked) ? linked : undefined;
}

function linkLocale(code: string): void {
  const url = new URL(location.href);
  url.searchParams.set("lang", code);
  history.replaceState(history.state, "", url);
}

function flagImage(code: string): Node {
  const url = flags[code];
  if (url !== undefined) {
    const image = new Image(20, 15);
    image.className = "language-flag";
    image.alt = "";
    image.src = url;
    return image;
  }
  const globe = document.createElement("span");
  globe.className = "language-flag language-globe";
  globe.innerHTML = globeIcon;
  return globe;
}

function createOption(code: string, label: string, choose: (code: string) => void): HTMLElement {
  const option = document.createElement("div");
  option.className = "language-option";
  option.dataset.code = code;
  option.tabIndex = -1;
  option.setAttribute("role", "option");
  const name = document.createElement("span");
  name.textContent = label;
  option.append(flagImage(code), name);
  option.addEventListener("click", () => choose(code));
  return option;
}

function handleListKey(event: KeyboardEvent, options: HTMLElement[], leave: () => void): void {
  const index = options.findIndex((option) => option.matches(":focus"));
  const last = options.length - 1;
  const moves: Record<string, number> = {
    ArrowDown: Math.min(index + 1, last),
    ArrowUp: Math.max(index - 1, 0),
    Home: 0,
    End: last,
  };
  const target = moves[event.key];
  if (target !== undefined) {
    event.preventDefault();
    options[target]?.focus();
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    options[index]?.click();
  } else if (event.key === "Escape") {
    event.preventDefault();
    leave();
  } else if (event.key === "Tab") {
    leave();
  }
}

function createTrigger(): HTMLButtonElement {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "language-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  return trigger;
}

function mountPicker(choose: (code: string) => void) {
  const host = document.querySelector<HTMLElement>(".site-nav, [data-language-host]");
  if (host === null) return undefined;
  const picker = document.createElement("div");
  picker.className = "language-picker";
  const trigger = createTrigger();
  const list = document.createElement("div");
  list.className = "language-list";
  list.setAttribute("role", "listbox");
  setOpen(false);

  function setOpen(isOpen: boolean): void {
    list.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) options.find((option) => option.getAttribute("aria-selected") === "true")?.focus();
  }

  function leave(): void {
    setOpen(false);
    trigger.focus();
  }

  const options = languages.map(([code, label]) =>
    createOption(code, label, (picked) => {
      leave();
      choose(picked);
    }),
  );
  list.append(...options);
  picker.append(trigger, list);
  host.insertBefore(picker, host.querySelector(".nav-button"));

  trigger.addEventListener("click", () => setOpen(list.hidden === true));
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setOpen(true);
  });
  list.addEventListener("keydown", (event) => handleListKey(event, options, leave));
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !picker.contains(event.target)) setOpen(false);
  });

  return (code: string, word: string): void => {
    const selected = options.find((option) => option.dataset.code === code);
    trigger.replaceChildren(...(selected?.cloneNode(true).childNodes ?? []));
    trigger.setAttribute("aria-label", `${word}: ${selected?.textContent ?? code}`);
    for (const option of options)
      option.setAttribute("aria-selected", String(option.dataset.code === code));
  };
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

const showSelected = mountPicker((code) => {
  saveLocale(code);
  linkLocale(code);
  void apply(code);
});
const slots = collectSlots();

async function apply(code: string): Promise<void> {
  const load = files[`../locales/${code}.json`];
  const strings = load === undefined ? {} : await load();
  document.documentElement.lang = code;
  document.documentElement.dir = rightToLeft.has(code) ? "rtl" : "ltr";
  for (const slot of slots) slot.write(strings[slot.key] ?? slot.english);
  showSelected?.(code, strings.language ?? "Language");
}

const linked = linkedLocale();
if (linked !== undefined) saveLocale(linked);
const initial = linked ?? savedLocale() ?? resolveLocale(navigator.languages);
showSelected?.(initial, "Language");
if (initial !== "en") void apply(initial);
