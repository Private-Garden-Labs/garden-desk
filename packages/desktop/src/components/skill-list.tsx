import type { SkillSummary } from "@gardendesk/shared";
import { type ReactNode, useState } from "react";
import { t } from "../i18n/index.js";
import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";
import { SkillHelp } from "./skill-help.js";

function SkillRow({ controller, skill }: { controller: SkillsController; skill: SkillSummary }) {
  const own = skill.source !== "built-in";
  return (
    <li className={`skill-row${skill.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">
          {skill.name}
          {own ? (
            <span className="skill-row-tag">
              {skill.source === "customized" ? t("skills.edited") : t("skills.added")}
            </span>
          ) : null}
        </p>
        <p className="skill-row-description">
          {skill.valid ? skill.description : t("skills.invalid")}
        </p>
      </div>
      <div className="skill-row-actions">
        <button
          aria-label={t("skills.edit", { name: skill.name })}
          className="skill-row-action"
          disabled={controller.working}
          onClick={() => controller.edit(skill)}
          title={t("skills.editShort")}
          type="button"
        >
          <Icon name="pencil" />
        </button>
        {own ? (
          <button
            aria-label={t("skills.remove", { name: skill.name })}
            className="skill-row-action"
            disabled={controller.working}
            onClick={() => controller.remove(skill.name)}
            title={skill.source === "customized" ? t("skills.restore") : t("skills.removeShort")}
            type="button"
          >
            <Icon name="trash" />
          </button>
        ) : null}
        <button
          aria-checked={skill.enabled}
          aria-label={t("skills.use", { name: skill.name })}
          className="skill-switch"
          disabled={controller.working}
          onClick={() => controller.setEnabled(skill.name, !skill.enabled)}
          role="switch"
          type="button"
        >
          <span />
        </button>
      </div>
    </li>
  );
}

function SkillGroup({
  controller,
  heading,
  skills,
}: {
  controller: SkillsController;
  heading: string;
  skills: SkillSummary[];
}) {
  if (skills.length === 0) return null;
  return (
    <section className="skill-group">
      <h3 className="skill-group-heading">
        <span>{heading}</span>
        <span>{skills.length}</span>
      </h3>
      <ul className="skill-list">
        {skills.map((skill) => (
          <SkillRow controller={controller} key={skill.name} skill={skill} />
        ))}
      </ul>
    </section>
  );
}

function AddZone({
  controller,
  nativeActionMessage,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
}) {
  return (
    <div className="skill-drop-zone">
      <p>{t("skills.drop")}</p>
      <p className="skill-drop-note">{t("skills.dropNote")}</p>
      <button
        className="skills-action"
        disabled={controller.working || nativeActionMessage !== undefined}
        onClick={controller.addFiles}
        title={nativeActionMessage}
        type="button"
      >
        {t("skills.chooseFile")}
      </button>
    </div>
  );
}

function matches(skill: SkillSummary, query: string): boolean {
  const text = `${skill.name} ${skill.description}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

function Toolbar({
  controller,
  nativeActionMessage,
  search,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
  search: ReactNode;
}) {
  return (
    <div className="skills-toolbar">
      {search}
      <button
        className="skills-action skills-primary"
        disabled={controller.working || nativeActionMessage !== undefined}
        onClick={controller.addFiles}
        title={nativeActionMessage}
        type="button"
      >
        <Icon name="add" />
        {t("skills.add")}
      </button>
      <button
        aria-label={t("skills.openFolder")}
        className="skills-action skills-icon-action"
        disabled={nativeActionMessage !== undefined}
        onClick={controller.openFolder}
        title={nativeActionMessage ?? t("skills.openFolder")}
        type="button"
      >
        <Icon name="folder" />
      </button>
    </div>
  );
}

export function SkillList({
  controller,
  nativeActionMessage,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
}) {
  const [query, setQuery] = useState("");
  const skills = controller.skills;
  if (skills === undefined) return <p className="skills-empty">{t("skills.reading")}</p>;
  const found = skills.filter((skill) => matches(skill, query));
  const own = found.filter((skill) => skill.source !== "built-in");
  return (
    <>
      <Toolbar
        controller={controller}
        nativeActionMessage={nativeActionMessage}
        search={
          skills.length > 8 ? (
            <label className="skills-search">
              <Icon name="search" />
              <input
                aria-label={t("skills.searchLabel")}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("skills.search")}
                type="search"
                value={query}
              />
            </label>
          ) : null
        }
      />
      <SkillHelp nativeActionMessage={nativeActionMessage} />
      {found.length === 0 ? <p className="skills-empty">{t("skills.noMatch")}</p> : null}
      {own.length === 0 && query === "" ? (
        <AddZone controller={controller} nativeActionMessage={nativeActionMessage} />
      ) : (
        <SkillGroup controller={controller} heading={t("skills.yours")} skills={own} />
      )}
      <SkillGroup
        controller={controller}
        heading={t("skills.builtIn")}
        skills={found.filter((skill) => skill.source === "built-in")}
      />
    </>
  );
}
