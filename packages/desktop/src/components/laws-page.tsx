import type { DataPackStatus, LawJurisdictionSummary } from "@gardendesk/shared";
import { type FormEvent, useState } from "react";
import { t } from "../i18n/index.js";
import { lawName } from "../law-names.js";
import type { LawsController } from "../laws.js";
import { fileSize } from "./generated-files.js";
import { Icon } from "./icons.js";

function PackAction({ controller, pack }: { controller: LawsController; pack: DataPackStatus }) {
  if (pack.state === "installed") return null;
  const locked = pack.access === "key" && controller.packs?.keySaved !== true;
  const label =
    pack.state === "downloading"
      ? t("dataPacks.downloading")
      : locked
        ? t("dataPacks.needsKey")
        : t(pack.state === "update" ? "dataPacks.update" : "dataPacks.download");
  return (
    <button
      className="skills-action skills-primary"
      disabled={controller.working || locked || pack.state === "downloading"}
      onClick={() => controller.install(pack.id)}
      type="button"
    >
      {label}
    </button>
  );
}

function PackDetails({ pack }: { pack: DataPackStatus }) {
  return (
    <>
      <p className="skill-row-description">
        {t("laws.current", { date: pack.currentAsOf })} · {fileSize(pack.bytes)}
        {pack.access === "free" ? ` · ${t("dataPacks.free")}` : ""}
      </p>
      {pack.failure === undefined ? null : (
        <p className="skill-row-description" role="alert">
          {t(`dataPacks.failed.${pack.failure}`)}
        </p>
      )}
    </>
  );
}

function PackRow({ controller, pack }: { controller: LawsController; pack: DataPackStatus }) {
  return (
    <li className="skill-row law-row">
      <div className="skill-row-copy">
        <p className="skill-row-name">{lawName({ id: pack.jurisdiction })}</p>
        <PackDetails pack={pack} />
      </div>
      <div className="skill-row-actions">
        <PackAction controller={controller} pack={pack} />
      </div>
    </li>
  );
}

function KeyForm({ controller }: { controller: LawsController }) {
  const [key, setKey] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    controller.saveKey(key);
  };
  const status = controller.keyStatus;
  return (
    <form className="skills-toolbar" onSubmit={submit}>
      <label className="skills-search">
        <Icon name="key" />
        <input
          aria-label={t("dataPacks.keyLabel")}
          autoComplete="off"
          onChange={(event) => setKey(event.target.value)}
          placeholder={
            controller.packs?.keySaved === true
              ? t("dataPacks.keyReplace")
              : t("dataPacks.keyPlaceholder")
          }
          spellCheck={false}
          value={key}
        />
      </label>
      <button
        className="skills-action skills-primary"
        disabled={controller.working || key.trim() === ""}
        type="submit"
      >
        {t("dataPacks.keySave")}
      </button>
      {status === undefined ? null : (
        <p className="skills-intro" role="status">
          {t(`dataPacks.key.${status}`)}
        </p>
      )}
    </form>
  );
}

function LawRow({
  controller,
  law,
  pack,
}: {
  controller: LawsController;
  law: LawJurisdictionSummary;
  pack: DataPackStatus | undefined;
}) {
  return (
    <li className={`skill-row law-row${law.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">{lawName(law)}</p>
        {pack === undefined ? (
          <p className="skill-row-description">{t("laws.current", { date: law.currentAsOf })}</p>
        ) : (
          <PackDetails pack={pack} />
        )}
        <details className="law-sources">
          <summary>
            {t("laws.sources", { count: law.sources.filter((source) => source.enabled).length })}
          </summary>
          <ul>
            {law.sources.map((source) => (
              <li key={source.id}>
                <label>
                  <input
                    checked={source.enabled}
                    disabled={controller.working || !law.enabled}
                    onChange={() => controller.setEnabled(law.id, !source.enabled, source.id)}
                    type="checkbox"
                  />
                  <span>
                    {source.title} <span className="law-source-version">{source.version}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div className="skill-row-actions">
        {pack === undefined ? null : <PackAction controller={controller} pack={pack} />}
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

function PackList({ controller }: { controller: LawsController }) {
  const laws = controller.laws ?? [];
  const packs = controller.packs?.packs ?? [];
  const packFor = (law: LawJurisdictionSummary) =>
    packs.find((pack) => pack.jurisdiction === law.id);
  return (
    <ul className="skill-list law-list">
      {laws.map((law) => (
        <LawRow controller={controller} key={law.id} law={law} pack={packFor(law)} />
      ))}
      {packs
        .filter((pack) => !laws.some((law) => law.id === pack.jurisdiction))
        .map((pack) => (
          <PackRow controller={controller} key={pack.id} pack={pack} />
        ))}
    </ul>
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
          <KeyForm controller={controller} />
          {controller.packs?.online === false ? (
            <p className="skills-intro" role="status">
              {t("dataPacks.offline")}
            </p>
          ) : null}
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
            <PackList controller={controller} />
          )}
        </div>
      </div>
    </main>
  );
}
