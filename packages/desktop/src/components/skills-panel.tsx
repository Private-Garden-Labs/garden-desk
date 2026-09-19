import { useEffect, useRef } from "react";
import type { SkillsController } from "../skills.js";
import { Icon } from "./icons.js";
import { SkillEditor } from "./skill-editor.js";
import { SkillList, useSkillSearch } from "./skill-list.js";

interface SkillsPanelProps {
  controller: SkillsController;
  dropActive: boolean;
  nativeActionMessage: string | undefined;
  onClose(): void;
  open: boolean;
}

function Toolbar({
  controller,
  nativeActionMessage,
  search,
}: {
  controller: SkillsController;
  nativeActionMessage: string | undefined;
  search: ReturnType<typeof useSkillSearch>;
}) {
  return (
    <div className="skills-toolbar">
      {search.visible ? (
        <label className="skills-search">
          <Icon name="search" />
          <input
            aria-label="Search skills"
            onChange={(event) => search.setQuery(event.target.value)}
            placeholder="Search"
            type="search"
            value={search.query}
          />
        </label>
      ) : (
        <span className="skills-toolbar-gap" />
      )}
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
    </div>
  );
}

function SheetHeader({ draft, onClose }: { draft: SkillsController["draft"]; onClose(): void }) {
  return (
    <header className="skills-header">
      <div>
        <h2 id="skills-title">{draft === undefined ? "Skills" : draft.name}</h2>
        <p>
          {draft === undefined
            ? "A skill tells Garden Desk how to do one kind of work. Turn one off to keep it out of every chat."
            : "Edit the instructions for this skill."}
        </p>
      </div>
      <button aria-label="Close skills" className="skills-close" onClick={onClose} type="button">
        <Icon name="close" />
      </button>
    </header>
  );
}

export function SkillsPanel(props: SkillsPanelProps) {
  const { controller, dropActive, nativeActionMessage, onClose, open } = props;
  const sheet = useRef<HTMLElement>(null);
  const search = useSkillSearch(controller.skills?.length ?? 0);
  useEffect(() => {
    if (open) sheet.current?.focus();
  }, [open]);
  if (!open) return null;
  const draft = controller.draft;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes the sheet on a click outside it.
    <div
      className="skills-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="skills-title"
        aria-modal="true"
        className={`skills-sheet${dropActive ? " skills-sheet-drop" : ""}`}
        data-drop-target="skills"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        ref={sheet}
        role="dialog"
        tabIndex={-1}
      >
        <SheetHeader draft={draft} onClose={onClose} />
        {draft === undefined ? (
          <Toolbar
            controller={controller}
            nativeActionMessage={nativeActionMessage}
            search={search}
          />
        ) : null}
        {controller.error === undefined ? null : (
          <p className="skills-error" role="alert">
            {controller.error}
          </p>
        )}
        {draft === undefined ? (
          <div className="skills-body">
            <SkillList
              controller={controller}
              nativeActionMessage={nativeActionMessage}
              query={search.query}
            />
          </div>
        ) : (
          <SkillEditor controller={controller} draft={draft} key={draft.name} />
        )}
      </section>
    </div>
  );
}
