import { MAX_SESSION_TITLE_LENGTH, type ModelRuntimeStatus } from "@gardendesk/shared";
import { useEffect, useRef, useState } from "react";
import { type AppearancePreference, nextAppearance } from "../appearance.js";
import { t } from "../i18n/index.js";
import { Icon } from "./icons.js";
import { SpecialistIcon, specialistIdentity } from "./specialist-run.js";

interface ChatHeaderProps {
  appearance: AppearancePreference;
  conversationTitle: string;
  renameMessage?: string | undefined;
  technicalDetailsOpen: boolean;
  model: ModelRuntimeStatus;
  specialistAgentId?: string | null | undefined;
  nativeActionMessage?: string | undefined;
  onAppearanceChange(): void;
  onRename(title: string): void;
  onTechnicalDetailsOpen(): void;
  onUnload(): void;
}

const appearanceLabel = (appearance: AppearancePreference) => t(`appearance.${appearance}`);

function AppearanceControl({
  appearance,
  onChange,
}: {
  appearance: AppearancePreference;
  onChange(): void;
}) {
  const values = {
    current: appearanceLabel(appearance),
    next: appearanceLabel(nextAppearance(appearance)),
  };
  return (
    <button
      aria-label={t("appearance.switch", values)}
      className="header-action appearance-action"
      onClick={onChange}
      title={t("appearance.title", values)}
      type="button"
    >
      <Icon name={`appearance-${appearance}`} />
    </button>
  );
}

function RenamePopover({
  title,
  onCancel,
  onSave,
}: {
  title: string;
  onCancel(): void;
  onSave(title: string): void;
}) {
  const [name, setName] = useState(title);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.select(), []);
  const trimmed = name.trim();
  return (
    <form
      aria-label={t("header.rename")}
      className="rename-popover"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      onMouseDown={(event) => {
        // Some webviews give a clicked button no focus, which would close the panel
        // through onBlur before the action runs.
        if (event.target !== field.current) event.preventDefault();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed.length > 0) onSave(trimmed);
      }}
    >
      <label htmlFor="conversation-name">{t("header.conversationName")}</label>
      <input
        className="rename-field"
        id="conversation-name"
        maxLength={MAX_SESSION_TITLE_LENGTH}
        onChange={(event) => setName(event.target.value)}
        ref={field}
        value={name}
      />
      <div className="rename-actions">
        <button onClick={onCancel} type="button">
          {t("common.cancel")}
        </button>
        <button className="rename-save" disabled={trimmed.length === 0} type="submit">
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}

function ConversationIdentity({
  conversationTitle,
  renameMessage,
  specialistAgentId,
  onRename,
}: Pick<
  ChatHeaderProps,
  "conversationTitle" | "renameMessage" | "specialistAgentId" | "onRename"
>) {
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="conversation-identity">
      {specialistAgentId === undefined ? null : (
        <span aria-label={specialistIdentity(specialistAgentId).name} role="img">
          <SpecialistIcon agentId={specialistAgentId} />
        </span>
      )}
      <strong className="conversation-title" title={conversationTitle}>
        {conversationTitle}
      </strong>
      <button
        aria-label={t("header.rename")}
        className="header-icon-action"
        disabled={renameMessage !== undefined}
        onClick={() => setRenaming(true)}
        title={renameMessage ?? t("header.rename")}
        type="button"
      >
        <Icon name="pencil" />
      </button>
      {renaming ? (
        <RenamePopover
          onCancel={() => setRenaming(false)}
          onSave={(title) => {
            setRenaming(false);
            if (title !== conversationTitle) onRename(title);
          }}
          title={conversationTitle}
        />
      ) : null}
    </div>
  );
}

function ModelCluster({
  model,
  nativeActionMessage,
  onUnload,
}: Pick<ChatHeaderProps, "model" | "nativeActionMessage" | "onUnload">) {
  const modelStatus = model.message ?? t(`model.${model.state}`);
  return (
    <div className={`model-cluster model-cluster-${model.state}`}>
      <span
        className={`model-state model-state-${model.state}`}
        title={`${model.name} · ${modelStatus}`}
      >
        <i aria-hidden="true" />
        <span className="model-state-text">{modelStatus}</span>
      </span>
      {model.state === "ready" ? (
        <button
          className="header-action unload-action"
          disabled={nativeActionMessage !== undefined}
          onClick={onUnload}
          title={nativeActionMessage ?? t("header.unloadModel")}
          type="button"
        >
          <Icon name="power" />
          <span>{t("header.unload")}</span>
        </button>
      ) : null}
    </div>
  );
}

export function ChatHeader({
  appearance,
  conversationTitle,
  renameMessage,
  technicalDetailsOpen,
  model,
  specialistAgentId,
  nativeActionMessage,
  onAppearanceChange,
  onRename,
  onTechnicalDetailsOpen,
  onUnload,
}: ChatHeaderProps) {
  return (
    <header className="chat-header" data-tauri-drag-region="">
      <ConversationIdentity
        conversationTitle={conversationTitle}
        onRename={onRename}
        renameMessage={renameMessage}
        specialistAgentId={specialistAgentId}
      />
      <div className="header-actions">
        <ModelCluster model={model} nativeActionMessage={nativeActionMessage} onUnload={onUnload} />
        <AppearanceControl appearance={appearance} onChange={onAppearanceChange} />
        <button
          aria-label={t("header.openTechnicalDetails")}
          className="header-action technical-details-action"
          disabled={technicalDetailsOpen}
          onClick={onTechnicalDetailsOpen}
          title={t("header.technicalDetails")}
          type="button"
        >
          <Icon name="activity" />
        </button>
      </div>
    </header>
  );
}
