import { Icon } from "./icons.js";

export function SidebarSettings({
  appVersion,
  onOpenReleases,
}: {
  appVersion: string | undefined;
  onOpenReleases(): void;
}) {
  return (
    <section aria-label="App settings" className="sidebar-settings">
      <p className="sidebar-version">
        {appVersion === undefined ? "Garden Desk" : `Version ${appVersion}`}
      </p>
      <button className="sidebar-release" onClick={onOpenReleases} type="button">
        <Icon name="download" />
        <span>Get the latest release</span>
      </button>
    </section>
  );
}
