import type { SkillSummary } from "@gardendesk/shared";
import { type ReactNode, useState } from "react";
import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";
import { SkillHelp } from "./skill-help.js";

const INVALID = "This file needs a name and a description at the top.";

function SkillRow({ controller, skill }: { controller: SkillsController; skill: SkillSummary }) {
  const own = skill.source !== "built-in";
  return (
    <li className={`skill-row${skill.enabled ? "" : " skill-row-off"}`}>
      <div className="skill-row-copy">
        <p className="skill-row-name">
          {skill.name}
          {own ? (
            <span className="skill-row-tag">
              {skill.source === "customized" ? "Edited" : "Added"}
            </span>
          ) : null}
        </p>
        <p className="skill-row-description">{skill.valid ? skill.description : INVALID}</p>
      </div>
      <div className="skill-row-actions">
        <button
          aria-label={`Edit ${skill.name}`}
          className="skill-row-action"
          disabled={controller.working}
          onClick={() => controller.edit(skill)}
          title="Edit"
          type="button"
        >
          <Icon name="pencil" />
        </button>
        {own ? (
          <button
            aria-label={`Remove ${skill.name}`}
            className="skill-row-action"
            disabled={controller.working}
            onClick={() => controller.remove(skill.name)}
            title={skill.source === "customized" ? "Restore the original" : "Remove"}
            type="button"
          >
            <Icon name="trash" />
          </button>
        ) : null}
        <button
          aria-checked={skill.enabled}
          aria-label={`Use ${skill.name}`}
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
      <p>Drop a skill file here</p>
      <p className="skill-drop-note">
        A skill is one Markdown file that starts with a name and a description.
      </p>
      <button
        className="skills-action"
        disabled={controller.working || nativeActionMessage !== undefined}
        onClick={controller.addFiles}
        title={nativeActionMessage}
        type="button"
      >
        Choose a file
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
  onDone,
  search,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
  onDone(): void;
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
        Add skill
      </button>
      <button
        aria-label="Open the skills folder"
        className="skills-action skills-icon-action"
        disabled={nativeActionMessage !== undefined}
        onClick={controller.openFolder}
        title={nativeActionMessage ?? "Open the skills folder"}
        type="button"
      >
        <Icon name="folder" />
      </button>
      <button className="skills-action" onClick={onDone} type="button">
        Done
      </button>
    </div>
  );
}

export function SkillList({
  controller,
  nativeActionMessage,
  onDone,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
  onDone(): void;
}) {
  const [query, setQuery] = useState("");
  const skills = controller.skills;
  if (skills === undefined) return <p className="skills-empty">Reading the skills…</p>;
  const found = skills.filter((skill) => matches(skill, query));
  const own = found.filter((skill) => skill.source !== "built-in");
  return (
    <>
      <Toolbar
        controller={controller}
        nativeActionMessage={nativeActionMessage}
        onDone={onDone}
        search={
          skills.length > 8 ? (
            <label className="skills-search">
              <Icon name="search" />
              <input
                aria-label="Search skills"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                type="search"
                value={query}
              />
            </label>
          ) : null
        }
      />
      <SkillHelp nativeActionMessage={nativeActionMessage} />
      {found.length === 0 ? <p className="skills-empty">No skill matches that search.</p> : null}
      {own.length === 0 && query === "" ? (
        <AddZone controller={controller} nativeActionMessage={nativeActionMessage} />
      ) : (
        <SkillGroup controller={controller} heading="Your skills" skills={own} />
      )}
      <SkillGroup
        controller={controller}
        heading="Built in"
        skills={found.filter((skill) => skill.source === "built-in")}
      />
    </>
  );
}
