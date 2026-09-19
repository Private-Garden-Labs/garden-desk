import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";
import { SkillEditor } from "./skill-editor.js";
import { SkillList } from "./skill-list.js";

interface SkillsPageProps {
  controller: SkillsController;
  dropActive: boolean;
  nativeActionMessage: string | undefined;
  onDone(): void;
}

function PageActions({
  controller,
  nativeActionMessage,
  onDone,
}: Omit<SkillsPageProps, "dropActive">) {
  return (
    <div className="skills-page-actions">
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

export function SkillsPage({
  controller,
  dropActive,
  nativeActionMessage,
  onDone,
}: SkillsPageProps) {
  const draft = controller.draft;
  return (
    <main
      aria-label="Skills"
      className={`workspace skills-page${dropActive ? " skills-page-drop" : ""}`}
      data-drop-target="skills"
    >
      <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region="" />
      <header className="skills-page-header">
        <div className="skills-page-title">
          <h1>{draft === undefined ? "Skills" : draft.name}</h1>
          <p>
            {draft === undefined
              ? "Each skill teaches Garden Desk one kind of work. Turn one off to keep it out of every chat."
              : draft.path}
          </p>
        </div>
        {draft === undefined ? (
          <PageActions
            controller={controller}
            nativeActionMessage={nativeActionMessage}
            onDone={onDone}
          />
        ) : null}
      </header>
      <div className="skills-page-body">
        <div className="skills-content">
          {controller.error === undefined ? null : (
            <p className="skills-error" role="alert">
              {controller.error}
            </p>
          )}
          {draft === undefined ? (
            <SkillList controller={controller} nativeActionMessage={nativeActionMessage} />
          ) : (
            <SkillEditor controller={controller} draft={draft} key={draft.name} />
          )}
        </div>
      </div>
    </main>
  );
}
