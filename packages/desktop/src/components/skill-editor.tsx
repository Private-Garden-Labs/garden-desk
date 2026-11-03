import { useState } from "react";
import { t } from "../i18n/index.js";
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
        aria-label={t("skills.editorFile", { name: draft.name })}
        className="skill-editor-text"
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        value={content}
      />
      <div className="skill-editor-actions">
        {draft.source === "built-in" ? (
          <p className="skill-editor-note">{t("skills.keepsVersion")}</p>
        ) : null}
        <button className="skills-action" onClick={controller.cancelEdit} type="button">
          {t("common.cancel")}
        </button>
        <button
          className="skills-action skills-primary"
          disabled={controller.working || content === draft.content}
          onClick={() => controller.save(content)}
          type="button"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
