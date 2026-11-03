import type { AgentArtifactSummary } from "@gardendesk/shared";
import { useState } from "react";
import type { ArtifactSaveResult } from "../artifact-actions.js";
import { t } from "../i18n/index.js";

type ActionState = ArtifactSaveResult | "idle" | "opening" | "saving";

const codeExtensions = new Set(["py", "pyc", "js", "mjs", "cjs", "sh"]);

function isCodeFile(item: AgentArtifactSummary): boolean {
  const extension = item.name.split(".").at(-1)?.toLocaleLowerCase("en-US") ?? "";
  return codeExtensions.has(extension);
}

function fileType(item: AgentArtifactSummary): { icon: string; label: string } {
  const extension = item.name.split(".").at(-1)?.toLocaleLowerCase("en-US");
  if (extension === "docx") return { icon: "W", label: t("files.word") };
  if (extension === "xlsx") return { icon: "X", label: t("files.excel") };
  if (extension === "pdf") return { icon: "P", label: t("files.pdf") };
  return {
    icon: "F",
    label: item.mediaType === "application/octet-stream" ? t("files.file") : item.mediaType,
  };
}

function fileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveLabel(state: ActionState): string {
  if (state === "saving") return t("files.saving");
  if (state === "saved") return t("files.saved");
  if (state === "failed") return t("files.failed");
  if (state === "cancelled") return t("files.cancelled");
  return t("files.saveAs");
}

function GeneratedFileCard({
  item,
  disabledReason,
  onOpen,
  onSave,
}: {
  item: AgentArtifactSummary;
  disabledReason: string | undefined;
  onOpen(item: AgentArtifactSummary): Promise<void>;
  onSave(item: AgentArtifactSummary): Promise<ArtifactSaveResult>;
}) {
  const [state, setState] = useState<ActionState>("idle");
  const type = fileType(item);
  const disabled = disabledReason !== undefined || state === "opening" || state === "saving";
  return (
    <article className="generated-file-card">
      <button
        aria-label={t("files.open", { name: item.name })}
        className="generated-file-open"
        disabled={disabled}
        onClick={() => {
          setState("opening");
          void onOpen(item).finally(() => setState("idle"));
        }}
        title={disabledReason}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`generated-file-icon generated-file-${type.icon.toLowerCase()}`}
        >
          {type.icon}
        </span>
        <span className="generated-file-description">
          <strong>{item.name}</strong>
          <span>
            {type.label} · {fileSize(item.byteLength)}
          </span>
        </span>
        {state === "opening" ? (
          <span className="generated-file-status" role="status">
            {t("files.opening")}
          </span>
        ) : null}
      </button>
      <button
        aria-label={t("files.saveNameAs", { name: item.name })}
        className="generated-file-save"
        disabled={disabled}
        onClick={() => {
          setState("saving");
          void onSave(item).then(setState);
        }}
        title={disabledReason}
        type="button"
      >
        <span aria-live="polite">{saveLabel(state)}</span>
      </button>
    </article>
  );
}

export function GeneratedFiles({
  artifacts,
  disabledReason,
  onOpen,
  onSave,
}: {
  artifacts: AgentArtifactSummary[];
  disabledReason: string | undefined;
  onOpen(item: AgentArtifactSummary): Promise<void>;
  onSave(item: AgentArtifactSummary): Promise<ArtifactSaveResult>;
}) {
  const documents = artifacts.filter((item) => !isCodeFile(item));
  if (documents.length === 0) return null;
  return (
    <section aria-label={t("files.generated")} className="generated-files">
      <h3>{t("files.generated")}</h3>
      {documents.map((item) => (
        <GeneratedFileCard
          disabledReason={disabledReason}
          item={item}
          key={item.id}
          onOpen={onOpen}
          onSave={onSave}
        />
      ))}
    </section>
  );
}
