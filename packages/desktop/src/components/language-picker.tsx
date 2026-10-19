import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { localeFlags } from "../i18n/flags.js";
import { setLocale, t, useLocale } from "../i18n/index.js";
import { type LocaleCode, localeOptions } from "../i18n/locales.js";
import { Icon } from "./icons.js";

function Flag({ code }: { code: LocaleCode }) {
  const src = localeFlags[code];
  if (src === undefined) {
    return (
      <svg aria-hidden="true" className="language-globe" viewBox="0 0 24 24">
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" />
      </svg>
    );
  }
  return <img alt="" className="language-flag" height={15} src={src} width={20} />;
}

function LanguageList({
  onChoose,
  onClose,
}: {
  onChoose(code: LocaleCode): void;
  onClose(): void;
}) {
  const locale = useLocale();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, []);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(list.current?.children ?? []) as HTMLElement[];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const target: Record<string, number> = {
      ArrowDown: Math.min(at + 1, items.length - 1),
      ArrowUp: Math.max(at - 1, 0),
      Home: 0,
      End: items.length - 1,
    };
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Tab") {
      onClose();
    } else if (target[event.key] !== undefined) {
      event.preventDefault();
      items[target[event.key] as number]?.focus();
    }
  };

  return (
    <div
      aria-label={t("settings.language")}
      className="language-list"
      onKeyDown={move}
      ref={list}
      role="listbox"
    >
      {localeOptions.map((option) => (
        <button
          aria-selected={option.code === locale}
          className="language-option"
          key={option.code}
          onClick={() => onChoose(option.code)}
          role="option"
          tabIndex={-1}
          type="button"
        >
          <span className="language-option-check">
            {option.code === locale ? <Icon name="check" /> : null}
          </span>
          <Flag code={option.code} />
          <span className="language-option-name">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function LanguagePicker() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = localeOptions.find((option) => option.code === locale);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="language-picker" ref={root}>
      {open ? (
        <LanguageList
          onChoose={(code) => {
            void setLocale(code);
            close();
          }}
          onClose={close}
        />
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t("settings.language")}: ${current?.label}`}
        className="language-trigger"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault();
          setOpen(true);
        }}
        ref={trigger}
        type="button"
      >
        <Flag code={locale} />
      </button>
    </div>
  );
}
