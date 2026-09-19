import type { SkillSummary } from "@gardendesk/shared";
import { useState } from "react";
import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";

const BADGES: Record<SkillSummary["source"], string> = {
  "built-in": "Built in",
  customized: "Edited",
  installed: "Added",
};

function SkillRow({ controller, skill }: { controller: SkillsController; skill: SkillSummary }) {
  return (
    <li className="skill-row">
      <div className="skill-row-copy">
        <p className="skill-row-name">
          {skill.name}
          <span className="skill-row-badge">{BADGES[skill.source]}</span>
        </p>
        <p className="skill-row-description">
          {skill.valid ? skill.description : "This file needs a name and a description."}
        </p>
      </div>
      <div className="skill-row-actions">
        <button
          aria-label={`Edit ${skill.name}`}
          disabled={controller.working}
          onClick={() => controller.edit(skill)}
          title="Edit"
          type="button"
        >
          <Icon name="pencil" />
        </button>
        {skill.source === "built-in" ? null : (
          <button
            aria-label={`Remove ${skill.name}`}
            disabled={controller.working}
            onClick={() => controller.remove(skill.name)}
            title={skill.source === "customized" ? "Restore the original" : "Remove"}
            type="button"
          >
            <Icon name="trash" />
          </button>
        )}
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

function SkillList({
  controller,
  nativeActionMessage,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
}) {
  const skills = controller.skills;
  return (
    <>
      <div className="skills-actions">
        <button
          className="skills-primary"
          disabled={controller.working || nativeActionMessage !== undefined}
          onClick={controller.addFiles}
          title={nativeActionMessage}
          type="button"
        >
          <Icon name="add" />
          Add skill
        </button>
        <button
          disabled={nativeActionMessage !== undefined}
          onClick={controller.openFolder}
          title={nativeActionMessage}
          type="button"
        >
          <Icon name="folder" />
          Open folder
        </button>
      </div>
      <p className="skills-hint">Drop a Markdown file on this panel to add a skill.</p>
      {skills === undefined ? (
        <p className="skills-empty">Reading the skills…</p>
      ) : (
        <ul className="skill-list">
          {skills.map((skill) => (
            <SkillRow controller={controller} key={skill.name} skill={skill} />
          ))}
        </ul>
      )}
    </>
  );
}

function SkillEditor({ controller }: { controller: SkillsController }) {
  const draft = controller.draft;
  const [content, setContent] = useState(draft?.content ?? "");
  if (draft === undefined) return null;
  return (
    <div className="skill-editor">
      <p className="skills-hint">
        {draft.source === "built-in"
          ? "Garden Desk keeps your version of this built-in skill. Remove it later to get the original back."
          : "The file starts with a name and a description, then the instructions."}
      </p>
      <textarea
        aria-label={`${draft.name} skill file`}
        className="skill-editor-text"
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        value={content}
      />
      <div className="skill-editor-actions">
        <button onClick={controller.cancelEdit} type="button">
          Cancel
        </button>
        <button
          className="skills-primary"
          disabled={controller.working}
          onClick={() => controller.save(content)}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function SkillsPanel({
  controller,
  nativeActionMessage,
  onClose,
  open,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
  onClose(): void;
  open: boolean;
}) {
  if (!open) return null;
  const draft = controller.draft;
  return (
    <div className="skills-backdrop">
      <section
        aria-labelledby="skills-title"
        aria-modal="true"
        className="skills-sheet"
        data-drop-target="skills"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        role="dialog"
      >
        <header className="skills-header">
          <div>
            <h2 id="skills-title">{draft === undefined ? "Skills" : draft.name}</h2>
            <p>
              {draft === undefined
                ? "A skill tells Garden Desk how to do one kind of work."
                : "Edit the instructions for this skill."}
            </p>
          </div>
          <button aria-label="Close skills" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </header>
        <div className="skills-body">
          {draft === undefined ? (
            <SkillList controller={controller} nativeActionMessage={nativeActionMessage} />
          ) : (
            <SkillEditor controller={controller} key={draft.name} />
          )}
        </div>
      </section>
    </div>
  );
}
