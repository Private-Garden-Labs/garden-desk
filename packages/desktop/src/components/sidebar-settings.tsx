import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.js";

interface SidebarSettingsProps {
  active: boolean;
  appVersion: string | undefined;
  onOpenReleases(): void;
  onOpenSkills(): void;
}

function useDismissOnOutsideClick(open: boolean, close: () => void) {
  const container = useRef<HTMLElement>(null);
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
      aria-label="App settings"
      className="sidebar-settings"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      ref={container}
    >
      {open ? (
        <div aria-label="Settings" className="sidebar-menu" role="menu">
          <button
            className="sidebar-menu-item"
            onClick={() => choose(onOpenSkills)}
            role="menuitem"
            type="button"
          >
            <Icon name="skill" />
            Skills
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => choose(onOpenReleases)}
            role="menuitem"
            title="Garden Desk does not check for updates. This opens gardendesk.ai/releases in your browser."
            type="button"
          >
            <Icon name="external" />
            Open the releases page
          </button>
          {appVersion === undefined ? null : (
            <p className="sidebar-menu-version">Version {appVersion}</p>
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
        Settings
      </button>
    </section>
  );
}
