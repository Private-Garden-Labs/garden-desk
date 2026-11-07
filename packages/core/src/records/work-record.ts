import { join } from "node:path";
import type { AgentRunSnapshot, AuditEvent } from "@gardendesk/shared";
import { writeNewFile } from "../agent/artifact-materialization.js";
import type { AgentStore } from "../agent/store.js";
import type { AuditLog } from "../audit/log.js";
import type { ConversationStore } from "../conversations/store.js";

export interface WorkRecordSources {
  audit: AuditLog;
  conversations: ConversationStore;
  store: AgentStore;
}

export const WORK_RECORD_LABELS = [
  "asked",
  "did",
  "files",
  "law",
  "audit",
  "chainVerified",
  "yes",
  "no",
] as const;
export type WorkRecordLabels = Record<(typeof WORK_RECORD_LABELS)[number], string>;

const FILE_TOOLS = new Set(["read", "write", "edit"]);

function sessionRuns(store: AgentStore, sessionId: string): AgentRunSnapshot[] {
  const pending = store.listRuns(sessionId).map((run) => run.id);
  const runs: AgentRunSnapshot[] = [];
  for (let runId = pending.shift(); runId !== undefined; runId = pending.shift()) {
    const snapshot = store.snapshot(runId);
    runs.push(snapshot);
    pending.push(...snapshot.childRuns.map((child) => child.id));
  }
  return runs;
}

function runRecord({ run, events, artifacts }: AgentRunSnapshot) {
  return {
    id: run.id,
    parentRunId: run.parentRunId,
    state: run.state,
    createdAt: run.createdAt,
    events: events.map(
      ({
        type,
        summary,
        toolName,
        command,
        language,
        path,
        exitCode,
        termination,
        stdout,
        createdAt,
      }) => ({
        type,
        summary,
        toolName,
        step:
          command?.split("\n")[0] ?? (language === null ? null : `${language} ${path ?? "code"}`),
        outcome: exitCode === null ? termination : `exit code ${exitCode}`,
        answer: type === "question.answered" ? stdout : null,
        createdAt,
      }),
    ),
    artifacts,
  };
}

function buildRecord(sources: WorkRecordSources, sessionId: string) {
  const { audit, conversations, store } = sources;
  return {
    sessionId,
    title: conversations.getTitle(sessionId),
    exportedAt: new Date().toISOString(),
    messages: conversations
      .listMessages(sessionId)
      .map(({ role, content, runId, createdAt }) => ({ role, content, runId, createdAt })),
    runs: sessionRuns(store, sessionId).map(runRecord),
    audit: {
      verified: audit.verify(),
      head: audit.head() ?? null,
      events: audit.sessionEvents(sessionId),
    },
  };
}

type WorkRecord = ReturnType<typeof buildRecord>;
type RecordEvent = WorkRecord["runs"][number]["events"][number];

function quoted(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function stepLine(event: RecordEvent): string | undefined {
  switch (event.type) {
    case "tool.completed":
      return `- ${event.toolName}: ${event.summary}`;
    case "execution.completed":
      return event.step === null
        ? `- ${event.summary}`
        : `- Ran \`${event.step}\`: ${event.outcome}`;
    case "question.asked":
      return "- Asked you a question.";
    case "question.answered":
      return `- You answered: ${event.answer}`;
    case "run.failed":
    case "run.cancelled":
      return `- ${event.summary}`;
    default:
      return undefined;
  }
}

function runSection(record: WorkRecord, run: WorkRecord["runs"][number], index: number): string {
  const kind = run.parentRunId === null ? "Task" : "Sub-task";
  const steps = run.events.map(stepLine).filter((line) => line !== undefined);
  const answer = record.messages.find(
    (message) => message.role === "assistant" && message.runId === run.id,
  );
  return [
    `### ${kind} ${index + 1} (${run.state}, ${run.createdAt})`,
    steps.length === 0 ? "No steps." : steps.join("\n"),
    ...(answer === undefined ? [] : ["Answer:", quoted(answer.content)]),
  ].join("\n\n");
}

function fileLines(record: WorkRecord): string[] {
  return record.runs.flatMap((run) => [
    ...run.events
      .filter((event) => event.type === "tool.completed" && FILE_TOOLS.has(event.toolName ?? ""))
      .map((event) => `- ${event.summary}`),
    ...run.artifacts.map((artifact) => `- Created ${artifact.name} (${artifact.byteLength} bytes)`),
  ]);
}

function lawLines(events: AuditEvent[]): string[] {
  return events
    .filter((event) => event.type === "pack.searched")
    .map(
      (event) => `- ${event.metadata.jurisdiction}: ${event.metadata.citations || "nothing found"}`,
    );
}

function list(lines: string[]): string {
  return lines.length === 0 ? "None." : lines.join("\n");
}

function markdown(record: WorkRecord, labels: WorkRecordLabels): string {
  const asked = record.messages.filter((message) => message.role === "user");
  const { audit } = record;
  return `${[
    `# Work record: ${record.title}`,
    `Exported ${record.exportedAt}. Conversation ${record.sessionId}.`,
    `## ${labels.asked}`,
    asked.length === 0 ? "None." : asked.map((message) => quoted(message.content)).join("\n\n"),
    `## ${labels.did}`,
    record.runs.length === 0
      ? "None."
      : record.runs.map((run, index) => runSection(record, run, index)).join("\n\n"),
    `## ${labels.files}`,
    list(fileLines(record)),
    `## ${labels.law}`,
    list(lawLines(audit.events)),
    `## ${labels.audit}`,
    [
      `- ${labels.chainVerified}: ${audit.verified ? labels.yes : labels.no}`,
      `- Audit head: sequence ${audit.head?.sequence ?? "none"}, ${audit.head?.hash ?? "no hash"}`,
      `- Audit rows for this conversation: ${audit.events.length}`,
    ].join("\n"),
  ].join("\n\n")}\n`;
}

function fileStem(record: WorkRecord): string {
  const title = record.title
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);
  const time = record.exportedAt.slice(0, 19).replace("T", "-").replaceAll(":", "");
  return `work-record-${title || record.sessionId}-${time}`;
}

export async function exportWorkRecord(
  sources: WorkRecordSources,
  sessionId: string,
  directory: string,
  labels: WorkRecordLabels,
): Promise<{ file: string; verified: boolean }> {
  try {
    const record = buildRecord(sources, sessionId);
    const stem = fileStem(record);
    const encoder = new TextEncoder();
    await writeNewFile(
      join(directory, `${stem}.json`),
      encoder.encode(`${JSON.stringify(record, null, 2)}\n`),
    );
    await writeNewFile(join(directory, `${stem}.md`), encoder.encode(markdown(record, labels)));
    sources.audit.append({
      type: "session.exported",
      outcome: "succeeded",
      metadata: { sessionId, files: 2 },
    });
    return { file: `${stem}.md`, verified: record.audit.verified };
  } catch (error) {
    sources.audit.append({ type: "session.exported", outcome: "failed", metadata: { sessionId } });
    throw error;
  }
}
