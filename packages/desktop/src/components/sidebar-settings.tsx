import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.js";

interface SidebarSettingsProps {
  appVersion: string | undefined;
  onOpenReleases(): void;
  onOpenSkills(): void;
}

export function SidebarSettings({
  appVersion,
  onOpenReleases,
  onOpenSkills,
}: SidebarSettingsProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);
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
          <p className="sidebar-menu-version">
            {appVersion === undefined ? "Version not available" : `Version ${appVersion}`}
          </p>
        </div>
      ) : null}
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="sidebar-settings-button"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Icon name="settings" />
        Settings
      </button>
    </section>
  );
}
