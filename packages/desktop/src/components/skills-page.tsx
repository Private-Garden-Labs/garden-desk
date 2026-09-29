import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";
import { SkillEditor } from "./skill-editor.js";
import { SkillList } from "./skill-list.js";

interface SkillsPageProps {
  controller: SkillsController;
  dropActive: boolean;
  nativeActionMessage: string | undefined;
  onBack(): void;
}

export function SkillsPage({
  controller,
  dropActive,
  nativeActionMessage,
  onBack,
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
        {draft === undefined ? (
          <button
            aria-label="Back to chat"
            className="header-icon-action"
            onClick={onBack}
            title="Back to chat"
            type="button"
          >
            <Icon name="chevron-left" />
          </button>
        ) : null}
        <h1>{draft === undefined ? "Skills" : draft.name}</h1>
      </header>
      <div className="skills-page-body">
        <div className="skills-content">
          <p className="skills-intro">
            {draft === undefined
              ? "Each skill teaches Garden Desk one kind of work. Turn one off to keep it out of every chat."
              : draft.path}
          </p>
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
