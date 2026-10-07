import { LAW_DISCLAIMER, type LawJurisdictionSummary } from "@gardendesk/shared";
import type { LawsController } from "../laws.js";
import { Icon } from "./icons.js";

function LawRow({ controller, law }: { controller: LawsController; law: LawJurisdictionSummary }) {
  return (
    <li className={`skill-row law-row${law.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">{law.name}</p>
        <p className="skill-row-description">Current as of {law.currentAsOf}</p>
        <details className="law-sources">
          <summary>Included acts ({law.sources.length})</summary>
          <ul>
            {law.sources.map((source) => (
              <li key={`${source.title} ${source.version}`}>
                {source.title} <span>{source.version}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="skill-row-actions">
        <button
          aria-checked={law.enabled}
          aria-label={`Use ${law.name}`}
          className="skill-switch"
          disabled={controller.working}
          onClick={() => controller.setEnabled(law.id, !law.enabled)}
          role="switch"
          type="button"
        >
          <span />
        </button>
      </div>
    </li>
  );
}

export function LawsPage({ controller, onBack }: { controller: LawsController; onBack(): void }) {
  return (
    <main aria-label="Laws" className="workspace skills-page">
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region="" />
      <header className="skills-page-header">
        <button
          aria-label="Back to chat"
          className="header-icon-action"
          onClick={onBack}
          title="Back to chat"
          type="button"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Laws</h1>
      </header>
      <div className="skills-page-body">
        <div className="skills-content">
          <p className="skills-intro">
            Garden Desk keeps a copy of these laws on this computer and works with them offline.
            Turn one on to choose it in the message box.
          </p>
          <p className="law-disclaimer" role="note">
            {LAW_DISCLAIMER}
          </p>
          {controller.error === undefined ? null : (
            <p className="skills-error" role="alert">
              {controller.error}
            </p>
          )}
          {controller.laws === undefined ? (
            <p className="skills-empty">Reading the law library…</p>
          ) : (
            <ul className="skill-list law-list">
              {controller.laws.map((law) => (
                <LawRow controller={controller} key={law.id} law={law} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
