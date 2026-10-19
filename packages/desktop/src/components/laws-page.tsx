import type { LawJurisdictionSummary } from "@gardendesk/shared";
import { t } from "../i18n/index.js";
import { lawName } from "../law-names.js";
import type { LawsController } from "../laws.js";
import { Icon } from "./icons.js";

function LawRow({ controller, law }: { controller: LawsController; law: LawJurisdictionSummary }) {
  return (
    <li className={`skill-row law-row${law.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">{lawName(law)}</p>
        <p className="skill-row-description">{t("laws.current", { date: law.currentAsOf })}</p>
        <details className="law-sources">
          <summary>{t("laws.sources", { count: law.sources.length })}</summary>
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
          aria-label={t("laws.use", { name: lawName(law) })}
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
    <main aria-label={t("settings.laws")} className="workspace skills-page">
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region="" />
      <header className="skills-page-header">
        <button
          aria-label={t("skills.back")}
          className="header-icon-action"
          onClick={onBack}
          title={t("skills.back")}
          type="button"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>{t("settings.laws")}</h1>
      </header>
      <div className="skills-page-body">
        <div className="skills-content">
          <p className="skills-intro">{t("laws.intro")}</p>
          <p className="law-disclaimer" role="note">
            {t("laws.disclaimer")}
          </p>
          {controller.error === undefined ? null : (
            <p className="skills-error" role="alert">
              {controller.error}
            </p>
          )}
          {controller.laws === undefined ? (
            <p className="skills-empty">{t("laws.loading")}</p>
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
