import type { CompanyPackBuild, LawJurisdictionSummary } from "@gardendesk/shared";
import { type FormEvent, useState } from "react";
import type { CompanyPacksController } from "../company-packs.js";
import { t } from "../i18n/index.js";
import type { LawsController } from "../laws.js";
import { Confirmation } from "./confirmation.js";

function buildMessage(build: CompanyPackBuild | undefined): string | undefined {
  if (build === undefined || build.state === "idle") return undefined;
  if (build.state === "built") return t("companyPacks.built", build);
  if (build.state !== "failed") return t("companyPacks.building");
  if (build.reason === "company_pack_empty") return t("companyPacks.buildFailed");
  return t("companyPacks.buildError", { reason: build.reason });
}

function BuildForm({ company }: { company: CompanyPacksController }) {
  const [name, setName] = useState("");
  const [publisher, setPublisher] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    company.build(name.trim(), publisher.trim());
  };
  const message = buildMessage(company.status?.build);
  const building = company.status?.build.state === "building";
  return (
    <>
      <form className="skills-toolbar" onSubmit={submit}>
        <label className="skills-search">
          <input
            aria-label={t("companyPacks.name")}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("companyPacks.name")}
            value={name}
          />
        </label>
        <label className="skills-search">
          <input
            aria-label={t("companyPacks.publisher")}
            onChange={(event) => setPublisher(event.target.value)}
            placeholder={t("companyPacks.publisher")}
            value={publisher}
          />
        </label>
        <button
          className="skills-action"
          disabled={building || name.trim() === "" || publisher.trim() === ""}
          type="submit"
        >
          {t("companyPacks.make")}
        </button>
      </form>
      {message === undefined ? null : (
        <p className="skills-intro" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function CompanyRow({
  controller,
  law,
}: {
  controller: LawsController;
  law: LawJurisdictionSummary;
}) {
  const pack = controller.packs?.packs.find((item) => item.jurisdiction === law.id);
  return (
    <li className={`skill-row law-row${law.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">{law.name}</p>
        <p className="skill-row-description">
          {t("companyPacks.details", { publisher: pack?.publisher ?? "", date: law.currentAsOf })}
        </p>
      </div>
      <div className="skill-row-actions">
        <button
          aria-checked={law.enabled}
          aria-label={t("laws.use", { name: law.name })}
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

function FolderFiles({ company }: { company: CompanyPacksController }) {
  const folder = company.status?.folder;
  return (
    <>
      <div className="skills-toolbar">
        <p className="skills-intro">
          {folder ? t("companyPacks.folder", { path: folder }) : t("companyPacks.noFolder")}
        </p>
        <button className="skills-action" onClick={company.chooseFolder} type="button">
          {t("companyPacks.chooseFolder")}
        </button>
      </div>
      <ul className="skill-list law-list">
        {company.status?.files.map((file) => (
          <li className="skill-row law-row" key={file.path}>
            <div className="skill-row-copy">
              <p className="skill-row-name">{file.name}</p>
            </div>
            <button
              className="skills-action skills-primary"
              disabled={company.importing}
              onClick={() => company.importPack(file.path)}
              type="button"
            >
              {t("companyPacks.importFile")}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CompanyPacksSection({ controller }: { controller: LawsController }) {
  const { company } = controller;
  const request = company.trustRequest;
  const installed = (controller.laws ?? []).filter((law) => law.id.startsWith("company:"));
  return (
    <section aria-label={t("companyPacks.title")}>
      <h2 className="company-packs-title">{t("companyPacks.title")}</h2>
      <p className="skills-intro">{t("companyPacks.intro")}</p>
      <div className="skills-toolbar">
        <button
          className="skills-action skills-primary"
          disabled={company.importing}
          onClick={() => company.importPack()}
          type="button"
        >
          {t("companyPacks.import")}
        </button>
      </div>
      {company.message === undefined ? null : (
        <p className="skills-intro" role="status">
          {company.message}
        </p>
      )}
      <ul className="skill-list law-list">
        {installed.map((law) => (
          <CompanyRow controller={controller} key={law.id} law={law} />
        ))}
      </ul>
      <FolderFiles company={company} />
      <BuildForm company={company} />
      <Confirmation
        onCancel={company.cancelTrust}
        onConfirm={company.trust}
        request={
          request === undefined
            ? undefined
            : {
                confirmLabel: t("companyPacks.trust"),
                description: t("companyPacks.trustDescription", {
                  publisher: request.publisher,
                  fingerprint: request.fingerprint,
                }),
                intent: "primary",
                onConfirm: company.trust,
                title: t("companyPacks.trustTitle"),
              }
        }
      />
    </section>
  );
}
