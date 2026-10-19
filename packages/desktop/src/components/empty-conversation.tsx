import { t } from "../i18n/index.js";

interface EmptyConversationProps {
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

export function EmptyConversation({ folderName, onSuggestion, ready }: EmptyConversationProps) {
  return (
    <div className="welcome">
      <h1>
        {folderName === undefined ? (
          t("welcome.title")
        ) : (
          <WelcomeInFolder folderName={folderName} />
        )}
      </h1>
      <p>{ready ? t("welcome.ready") : t("welcome.starting")}</p>
      <div className="suggestions">
        <button
          disabled={!ready}
          onClick={() => onSuggestion(t("welcome.explorePrompt"))}
          type="button"
        >
          {t("welcome.explore")}
        </button>
        <button
          disabled={!ready}
          onClick={() => onSuggestion(t("welcome.reviewPrompt"))}
          type="button"
        >
          {t("welcome.review")}
        </button>
        <button
          disabled={!ready}
          onClick={() => onSuggestion(t("welcome.comparePrompt"))}
          type="button"
        >
          {t("welcome.compare")}
        </button>
        <button
          disabled={!ready}
          onClick={() => onSuggestion(t("welcome.diagnosePrompt"))}
          type="button"
        >
          {t("welcome.diagnose")}
        </button>
      </div>
    </div>
  );
}
