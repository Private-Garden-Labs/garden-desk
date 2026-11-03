import { t } from "../i18n/index.js";
import type { TimelineItem } from "../state.js";

interface RunProgressProps {
  runId: string | undefined;
  timeline: TimelineItem[];
}

export function RunProgress({ runId, timeline }: RunProgressProps) {
  const current = timeline.filter((item) => item.kind === "activity" && item.runId === runId);
  const completedTools = current.filter((item) => item.eventType === "tool.completed").length;
  const completedExecutions = current.filter(
    (item) => item.eventType === "execution.completed",
  ).length;
  const progress =
    completedTools > 0
      ? t("progress.tools", { count: completedTools })
      : completedExecutions > 0
        ? t("progress.executions", { count: completedExecutions })
        : t("progress.planning");
  return (
    <article className="thinking-stream run-progress">
      <header>
        <span aria-hidden="true" className="thinking-pulse" />
        {t("progress.working")}
      </header>
      <p>{current.at(-1)?.text ?? t("progress.starting")}</p>
      <small>{progress}</small>
    </article>
  );
}
