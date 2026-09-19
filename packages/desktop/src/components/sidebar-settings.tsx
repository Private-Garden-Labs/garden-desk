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
      <button
        className="sidebar-release"
        onClick={onOpenReleases}
        title="Garden Desk does not check for updates. This opens gardendesk.ai/releases in your browser."
        type="button"
      >
        <Icon name="external" />
        <span className="sidebar-release-copy">
          <span>Open the releases page</span>
          {appVersion === undefined ? null : (
            <span className="sidebar-version">Version {appVersion} installed</span>
          )}
        </span>
      </button>
    </section>
  );
}
