import type { ModelRuntimeStatus } from "@gardendesk/shared";
import type { DesktopApi } from "../api.js";
import type { AppearancePreference } from "../appearance.js";
import { renameConversation } from "../conversation-rename.js";
import { activeSessionTitle } from "../session-state.js";
import type { DesktopAction, DesktopState } from "../state.js";
import { ChatHeader } from "./chat-header.js";

interface AppChatHeaderProps {
  api: DesktopApi;
  appearance: AppearancePreference;
  dispatch(action: DesktopAction): void;
  model: ModelRuntimeStatus;
  nativeActionMessage: string | undefined;
  setError(message: string | undefined): void;
  specialistAgentId?: string | null | undefined;
  state: DesktopState;
  technicalDetailsOpen: boolean;
  onAppearanceChange(): void;
  onTechnicalDetailsOpen(): void;
  onUnload(): void;
}

export function AppChatHeader(props: AppChatHeaderProps) {
  const { api, dispatch, setError, state } = props;
  const sessionId = state.activeSessionId;
  return (
    <ChatHeader
      appearance={props.appearance}
      conversationTitle={activeSessionTitle(state) ?? "New chat"}
      model={props.model}
      nativeActionMessage={props.nativeActionMessage}
      onAppearanceChange={props.onAppearanceChange}
      onRename={(title) => {
        if (sessionId !== undefined) {
          void renameConversation({ api, sessionId, title, dispatch, setError });
        }
      }}
      onTechnicalDetailsOpen={props.onTechnicalDetailsOpen}
      onUnload={props.onUnload}
      renameMessage={
        props.nativeActionMessage ??
        (sessionId === undefined ? "Send a message to name this chat" : undefined)
      }
      specialistAgentId={props.specialistAgentId}
      technicalDetailsOpen={props.technicalDetailsOpen}
    />
  );
}
