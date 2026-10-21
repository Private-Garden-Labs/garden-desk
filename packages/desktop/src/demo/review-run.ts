import type {
  AgentEvent,
  AgentExecutionSnapshot,
  AgentRunState,
  ThinkingLevel,
} from "@gardendesk/shared";
import { AgentEventSchema, AgentExecutionSnapshotSchema } from "@gardendesk/shared";
import { reviewScript } from "./review-script.js";

// Milliseconds after the user sends the prompt.
const timing = {
  running: 400,
  thinking: [
    { start: 3_600, end: 6_600, done: 7_000 },
    { start: 10_100, end: 13_100, done: 13_400 },
    { start: 16_700, end: 19_200, done: 19_400 },
  ],
  inference: [400, 9_800, 16_400],
  skill: { start: 7_000, end: 7_700 },
  read: { start: 7_900, end: 9_600 },
  code: { start: 13_400, end: 16_200 },
  response: { start: 19_400, end: 27_000 },
} as const;

export const REVIEW_DURATION_MS = timing.response.end;

export interface ReviewRun {
  attachmentName: string;
  runId: string;
  sequence: number;
  startedAt: number;
  thinking: ThinkingLevel;
}

export interface ReviewProgress {
  state: AgentRunState;
  events: AgentEvent[];
  executions: AgentExecutionSnapshot[];
  thinking: string | null;
  response: string | null;
  contextUsedTokens: number | null;
}

export function uuid(group: number, sequence: number): string {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${sequence
    .toString(16)
    .padStart(12, "0")}`;
}

function streamed(text: string, start: number, end: number, elapsed: number): string {
  const share = Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
  return text.slice(0, Math.round(text.length * share));
}

function attachmentPath(name: string): string {
  return `/run/attachments/01-${name}`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one ordered script of the demo run.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one ordered script of the demo run.
export function reviewProgress(run: ReviewRun, elapsed: number): ReviewProgress {
  const script = reviewScript();
  const at = (offset: number) => new Date(run.startedAt + offset).toISOString();
  const items: Array<Partial<AgentEvent> & Pick<AgentEvent, "type" | "summary" | "createdAt">> = [
    { type: "run.started", summary: script.runStarted, createdAt: at(0) },
  ];
  const add = (offset: number, event: Omit<(typeof items)[number], "createdAt">) => {
    if (elapsed >= offset) items.push({ ...event, createdAt: at(offset) });
  };
  const inference = (index: 0 | 1 | 2) => {
    const step = timing.thinking[index];
    add(timing.inference[index], {
      type: "inference.started",
      summary: index === 0 ? script.loadingModel : script.choosingAction,
      durationMs: elapsed >= step.done ? step.end - step.start : null,
    });
  };
  const path = attachmentPath(run.attachmentName);
  inference(0);
  add(timing.skill.start, {
    type: "tool.started",
    summary: script.loadingSkill,
    toolName: "skill",
    toolCallId: "call_skill_document_review",
  });
  add(timing.skill.end, {
    type: "tool.completed",
    summary: script.loadedSkill,
    toolName: "skill",
    toolCallId: "call_skill_document_review",
  });
  add(timing.read.start, {
    type: "tool.started",
    summary: script.reading(path),
    toolName: "read",
    toolCallId: "call_read_attachment",
  });
  add(timing.read.end, {
    type: "tool.completed",
    summary: script.read(path),
    toolName: "read",
    toolCallId: "call_read_attachment",
    stdout: script.readOutput,
  });
  inference(1);
  const code = {
    toolName: "python",
    toolCallId: "call_python_checks",
    language: "python" as const,
    path: "check_contract.py",
    source: script.code,
  };
  add(timing.code.start, { type: "tool.started", summary: script.runningCode, ...code });
  add(timing.code.start + 50, {
    type: "execution.started",
    summary: script.executionRunning,
    ...code,
  });
  const codeDone = {
    exitCode: 0,
    stdout: script.codeOutput,
    stderr: "",
    durationMs: timing.code.end - timing.code.start - 200,
    termination: "completed" as const,
  };
  add(timing.code.end - 150, {
    type: "execution.completed",
    summary: script.executionFinished,
    ...code,
    ...codeDone,
  });
  add(timing.code.end, { type: "tool.completed", summary: script.ranCode, ...code, ...codeDone });
  inference(2);
  add(timing.response.end, { type: "assistant.completed", summary: script.responseCompleted });

  const events = AgentEventSchema.array().parse(
    items.map((item, index) => ({
      ...item,
      id: uuid(11, run.sequence * 100 + index),
      runId: run.runId,
      sequence: index,
    })),
  );
  const executions =
    elapsed < timing.code.start + 50
      ? []
      : [
          AgentExecutionSnapshotSchema.parse({
            id: uuid(12, run.sequence),
            runId: run.runId,
            sequence: 0,
            language: "python",
            path: code.path,
            source: code.source,
            command: null,
            state: elapsed >= timing.code.end ? "completed" : "running",
            exitCode: elapsed >= timing.code.end ? 0 : null,
            durationMs: elapsed >= timing.code.end ? codeDone.durationMs : null,
            termination: elapsed >= timing.code.end ? "completed" : null,
            stdout: elapsed >= timing.code.end ? script.codeOutput : "",
            stderr: "",
            vmDiagnostics: [],
            stdoutBytes: elapsed >= timing.code.end ? script.codeOutput.length : 0,
            stderrBytes: 0,
            vmDiagnosticsBytes: 0,
            stdoutTruncated: false,
            stderrTruncated: false,
            vmDiagnosticsTruncated: false,
            createdAt: at(timing.code.start + 50),
            updatedAt: at(Math.min(elapsed, timing.code.end)),
            completedAt: elapsed >= timing.code.end ? at(timing.code.end) : null,
          }),
        ];
  const thinkingIndex = timing.thinking.findIndex(
    (step) => elapsed >= step.start && elapsed < step.done,
  );
  const thinkingStep = timing.thinking[thinkingIndex];
  const report = script.report(run.attachmentName);
  return {
    state:
      elapsed < timing.running ? "queued" : elapsed < timing.response.end ? "running" : "succeeded",
    events,
    executions,
    thinking:
      thinkingStep === undefined
        ? null
        : streamed(
            script.thinking[thinkingIndex] ?? "",
            thinkingStep.start,
            thinkingStep.end,
            elapsed,
          ),
    response:
      elapsed < timing.response.start
        ? null
        : streamed(report, timing.response.start, timing.response.end, elapsed) || null,
    contextUsedTokens:
      elapsed < timing.running
        ? null
        : elapsed < timing.read.end
          ? 4_180
          : elapsed < timing.code.end
            ? 6_952
            : elapsed < timing.response.end
              ? 7_412
              : 8_258,
  };
}
