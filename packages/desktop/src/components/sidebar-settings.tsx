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
      <button className="sidebar-release" onClick={onOpenReleases} type="button">
        <Icon name="download" />
        <span className="sidebar-release-copy">
          <span>Get the latest release</span>
          {appVersion === undefined ? null : (
            <span className="sidebar-version">Version {appVersion} installed</span>
          )}
        </span>
      </button>
    </section>
  );
}
