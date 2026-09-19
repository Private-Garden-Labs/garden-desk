import { useState } from "react";
import type { SkillDraft, SkillsController } from "../skills.js";

export function SkillEditor({
  controller,
  draft,
}: {
  controller: SkillsController;
  draft: SkillDraft;
}) {
  const [content, setContent] = useState(draft.content);
  return (
    <div className="skill-editor">
      <textarea
        aria-label={`${draft.name} skill file`}
        className="skill-editor-text"
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        value={content}
      />
      <div className="skill-editor-actions">
        {draft.source === "built-in" ? (
          <p className="skill-editor-note">
            Garden Desk keeps your version. Remove it later to get the original back.
          </p>
        ) : null}
        <button className="skills-action" onClick={controller.cancelEdit} type="button">
          Cancel
        </button>
        <button
          className="skills-action skills-primary"
          disabled={controller.working || content === draft.content}
          onClick={() => controller.save(content)}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}
