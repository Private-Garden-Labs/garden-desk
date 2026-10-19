import type { CommandSummary } from "@gardendesk/shared";
import { t } from "../i18n/index.js";
import { commandDescription, suggestedWorkflows } from "../workflow-suggestions.js";

interface EmptyConversationProps {
  attachmentNames: string[];
  commands: CommandSummary[];
  folderFileNames: string[];
  folderName?: string | undefined;
  onSuggestion(text: string): void;
  ready: boolean;
}

function WelcomeInFolder({ folderName }: { folderName: string }) {
  const [before, after] = t("welcome.titleInFolder", { folder: "\u0000" }).split("\u0000");
  return (
    <>
      {before}
      <span className="welcome-folder">{folderName}</span>
      {after}
    </>
  );
}

function subtitle(attachmentNames: string[], folderName: string | undefined): string {
  const [name] = attachmentNames;
  if (name !== undefined && attachmentNames.length === 1) return t("welcome.readyFile", { name });
  if (attachmentNames.length > 1) return t("welcome.readyFiles");
  return folderName === undefined ? t("welcome.ready") : t("welcome.readyFolder");
}

function focusComposerEnd() {
  requestAnimationFrame(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(".composer textarea");
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

export function EmptyConversation({
  attachmentNames,
  commands,
  folderFileNames,
  folderName,
  onSuggestion,
  ready,
}: EmptyConversationProps) {
  return (
    <div className="welcome">
      <h1>
        {folderName === undefined ? (
          t("welcome.title")
        ) : (
          <WelcomeInFolder folderName={folderName} />
        )}
      </h1>
      <p>{ready ? subtitle(attachmentNames, folderName) : t("welcome.starting")}</p>
      <div className="suggestions">
        {suggestedWorkflows(commands, attachmentNames, folderFileNames).map((command) => (
          <button
            disabled={!ready}
            key={command.name}
            onClick={() => {
              onSuggestion(`/${command.name} `);
              focusComposerEnd();
            }}
            type="button"
          >
            <span className="suggestion-command">/{command.name}</span>
            <span>{commandDescription(command)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
