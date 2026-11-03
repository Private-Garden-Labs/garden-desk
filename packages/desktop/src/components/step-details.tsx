import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../i18n/index.js";
import type { AgentStep } from "../steps.js";
import { followThinkingText } from "../thinking-scroll.js";
import { Icon } from "./icons.js";
import { SourceCode } from "./source-code.js";
import { ExecutionStatus, StreamTabs } from "./technical-logs.js";
import { copyUserMessage } from "./user-message.js";

type CopyState = "copied" | "failed" | "idle";

function copyLabel(state: CopyState): string {
  return t(`copy.${state === "idle" ? "copy" : state}`);
}

export async function copyStepText(
  value: string,
  clipboard?: Pick<Clipboard, "writeText">,
): Promise<void> {
  await copyUserMessage(value, clipboard ?? globalThis.navigator?.clipboard);
}

function StepTextBlock({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  const [wrap, setWrap] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const valueViewer = useRef<HTMLTextAreaElement>(null);
  useEffect(
    () => () => {
      if (resetTimer.current !== undefined) clearTimeout(resetTimer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (live && valueViewer.current !== null) followThinkingText(valueViewer.current);
  });
  const copy = async () => {
    try {
      await copyStepText(value);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    if (resetTimer.current !== undefined) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 2_000);
  };
  const copyButtonLabel = copyLabel(copyState);
  return (
    <details className="step-detail-block" open={live || undefined}>
      <summary>{label}</summary>
      <div className="technical-log-viewer">
        <textarea
          className={wrap ? "step-detail-wrap" : undefined}
          aria-label={label}
          readOnly
          ref={valueViewer}
          value={value}
        />
        <footer className="step-detail-controls">
          <label>
            <input
              aria-label={t("steps.wrapFor", { label })}
              checked={wrap}
              onChange={(event) => setWrap(event.currentTarget.checked)}
              type="checkbox"
            />
            {t("steps.wrap")}
          </label>
          <button
            aria-label={t("steps.copyLabel", { action: copyButtonLabel, label })}
            onClick={() => void copy()}
            title={copyButtonLabel}
            type="button"
          >
            <Icon name={copyState === "copied" ? "copy-check" : "copy"} />
            <span aria-live="polite">{copyButtonLabel}</span>
          </button>
        </footer>
      </div>
    </details>
  );
}

function StepEvidence({ step }: { step: AgentStep }) {
  const execution = step.execution;
  if (execution === undefined) return null;
  const source = execution.source ?? execution.command;
  const path = execution.path ?? t("steps.guestShell");
  return (
    <>
      <p>
        {t("steps.termination", { value: execution.termination ?? t("steps.inProgress") })}
        {execution.exitCode === null ? "" : t("steps.exit", { code: execution.exitCode })}
      </p>
      {source === null && execution.path !== null ? (
        <p>
          {t("steps.sourcePath")} <code>{execution.path}</code>
        </p>
      ) : source === null ? null : (
        <details className="step-detail-block">
          <summary>{t("steps.code")}</summary>
          <SourceCode language={execution.language} path={path} source={source} />
        </details>
      )}
      <StreamTabs execution={execution} />
    </>
  );
}

function StepInference({
  step,
  thinking,
  thinkingLive,
}: {
  step: AgentStep;
  thinking: string | null;
  thinkingLive: boolean;
}) {
  const turn = step.turn;
  if (turn === undefined) {
    return <p className="step-detail-empty">{t("steps.notLoaded")}</p>;
  }
  return (
    <>
      <p>
        {t("steps.turn", {
          model: turn.modelId,
          tokens: turn.allocatedContextTokens ?? t("steps.unknown"),
          outcome: turn.outcome ?? t("steps.inProgress"),
        })}
      </p>
      {thinking === null || thinking.length === 0 ? null : (
        <StepTextBlock label={t("steps.thinking")} live={thinkingLive} value={thinking} />
      )}
      <StepTextBlock label={t("steps.prompt")} value={turn.prompt} />
      <StepTextBlock label={t("steps.shape")} value={JSON.stringify(turn.jsonSchema, null, 2)} />
      <StepTextBlock
        label={t("steps.decision")}
        value={
          turn.structuredResponse === null
            ? t("steps.noDecision")
            : JSON.stringify(turn.structuredResponse, null, 2)
        }
      />
    </>
  );
}

export function StepDetails({
  step,
  thinking,
  thinkingLive = false,
}: {
  step: AgentStep;
  thinking: string | null;
  thinkingLive?: boolean;
}) {
  return (
    <div className="step-details">
      <div className="execution-heading">
        <p>
          {t("steps.titled", {
            ordinal: step.ordinal,
            title: step.execution?.language ?? step.kind,
          })}
        </p>
        {step.execution === undefined ? null : <ExecutionStatus execution={step.execution} />}
      </div>
      <p className="step-detail-title">{step.title}</p>
      {step.execution === undefined && step.detail !== undefined ? (
        <StepTextBlock label={t("steps.detailsLabel")} value={step.detail} />
      ) : null}
      <StepEvidence step={step} />
      <StepInference step={step} thinking={thinking} thinkingLive={thinkingLive} />
    </div>
  );
}
