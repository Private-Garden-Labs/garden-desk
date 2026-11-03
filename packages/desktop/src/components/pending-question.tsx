import type { AgentQuestionRequest, AgentRunSummary } from "@gardendesk/shared";
import type { DesktopApi } from "../api.js";
import { t } from "../i18n/index.js";
import { QuestionPrompt } from "./question-prompt.js";

interface PendingQuestionProps {
  api: DesktopApi;
  request: AgentQuestionRequest;
  run: AgentRunSummary | undefined;
  setError(message: string): void;
}

export function PendingQuestion({ api, request, run, setError }: PendingQuestionProps) {
  return (
    <QuestionPrompt
      key={request.id}
      onAnswer={(questionId, answers) => {
        if (run === undefined) return;
        void api
          .answerQuestion(run.id, questionId, answers)
          .catch(() => setError(t("question.answerFailed")));
      }}
      onDismiss={(questionId) => {
        if (run === undefined) return;
        void api
          .dismissQuestion(run.id, questionId)
          .catch(() => setError(t("question.dismissFailed")));
      }}
      onStop={() => {
        if (run === undefined) return;
        void api.cancelAgent(run.jobId).catch(() => setError(t("task.cancelFailed")));
      }}
      request={request}
      stopping={run?.state === "cancelled"}
    />
  );
}
