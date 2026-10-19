import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";
import { Icon } from "./icons.js";
import { LanguagePicker } from "./language-picker.js";

interface SidebarSettingsProps {
  active: boolean;
  appVersion: string | undefined;
  onOpenReleases(): void;
  onOpenSkills(): void;
}

function useDismissOnOutsideClick(open: boolean, close: () => void) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [close, open]);
  return container;
}

export function SidebarSettings({
  active,
  appVersion,
  onOpenReleases,
  onOpenSkills,
}: SidebarSettingsProps) {
  const [open, setOpen] = useState(false);
  const container = useDismissOnOutsideClick(open, () => setOpen(false));
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  return (
    <section
      aria-label={t("settings.appSettings")}
      className="sidebar-settings"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <div className="sidebar-settings-main" ref={container}>
        {open ? (
          <div aria-label={t("settings.menu")} className="sidebar-menu" role="menu">
            <button
              className="sidebar-menu-item"
              onClick={() => choose(onOpenSkills)}
              role="menuitem"
              type="button"
            >
              <Icon name="skill" />
              {t("settings.skills")}
            </button>
            <button
              className="sidebar-menu-item"
              onClick={() => choose(onOpenReleases)}
              role="menuitem"
              title={t("settings.releasesTitle")}
              type="button"
            >
              <Icon name="external" />
              {t("settings.releases")}
            </button>
            {appVersion === undefined ? null : (
              <p className="sidebar-menu-version">
                {t("settings.version", { version: appVersion })}
              </p>
            )}
          </div>
        ) : null}
        <button
          aria-current={active ? "page" : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`sidebar-settings-button${active ? " sidebar-settings-button-active" : ""}`}
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Icon name="settings" />
          {t("settings.menu")}
        </button>
      </div>
      <LanguagePicker />
    </section>
  );
}
