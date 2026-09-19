import { MAX_SESSION_TITLE_LENGTH, type ModelRuntimeStatus } from "@gardendesk/shared";
import { useEffect, useRef, useState } from "react";
import { type AppearancePreference, nextAppearance } from "../appearance.js";
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

const statusText: Record<ModelRuntimeStatus["state"], string> = {
  unsupported: "Not supported on this Mac",
  unloaded: "Loads with your next message",
  loading: "Loading on device",
  busy: "Working on device",
  ready: "Loaded and ready",
};

const appearanceLabels: Record<AppearancePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function AppearanceControl({
  appearance,
  onChange,
}: {
  appearance: AppearancePreference;
  onChange(): void;
}) {
  const next = nextAppearance(appearance);
  return (
    <button
      aria-label={`Appearance: ${appearanceLabels[appearance]}. Switch to ${appearanceLabels[next]}`}
      className="header-action appearance-action"
      onClick={onChange}
      title={`Appearance: ${appearanceLabels[appearance]} · Next: ${appearanceLabels[next]}`}
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
      aria-label="Rename conversation"
      className="rename-popover"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed.length > 0) onSave(trimmed);
      }}
    >
      <label htmlFor="conversation-name">Conversation name</label>
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
          Cancel
        </button>
        <button className="rename-save" disabled={trimmed.length === 0} type="submit">
          Save
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
        aria-label="Rename conversation"
        className="rename-action"
        disabled={renameMessage !== undefined}
        onClick={() => setRenaming(true)}
        title={renameMessage ?? "Rename conversation"}
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
  const modelStatus = model.message ?? statusText[model.state];
  return (
    <div className={`model-cluster model-cluster-${model.state}`}>
      <span
        className={`model-state model-state-${model.state}`}
        title={`${model.name} · ${modelStatus}`}
      >
        <i aria-hidden="true" />
        <span className="model-state-text">{modelStatus}</span>
      </span>
      <button
        className="header-action unload-action"
        disabled={model.state !== "ready" || nativeActionMessage !== undefined}
        onClick={onUnload}
        title={
          nativeActionMessage ??
          (model.state === "ready" ? "Unload model from memory" : modelStatus)
        }
        type="button"
      >
        <Icon name="power" />
        <span>Unload</span>
      </button>
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
          aria-label="Open technical details"
          className="header-action technical-details-action"
          disabled={technicalDetailsOpen}
          onClick={onTechnicalDetailsOpen}
          title="Technical details"
          type="button"
        >
          <Icon name="activity" />
        </button>
      </div>
    </header>
  );
}
