import type {
  AgentEvent,
  AgentEventDetail,
  AgentEventType,
  AgentQuestion,
  AgentRunResult,
  AgentRunSummary,
  ConversationMessage,
  ThinkingLevel,
} from "@gardendesk/shared";
import type { CommandInvocation } from "../commands/library.js";
import { runCommand } from "../commands/run.js";
import type { JobStore } from "../jobs/jobs.js";
import type { InferenceService } from "../runtime/inference.js";
import type { DatabasePort } from "../workspace/database.js";
import { agentSkillReader } from "./agent-skills.js";
import { ChatAgentLoop } from "./chat-loop.js";
import type { ChatAgentInput } from "./chat-loop-input.js";
import type { AgentQuestionOutcome } from "./generic-tool-support.js";
import { guestAttachmentName } from "./inputs.js";
import type { MarkdownDefinitionLibrary } from "./markdown-definition-library.js";
import { runInternalReview } from "./review-run.js";
import { createRunExecutor } from "./service-executor.js";
import type { AgentSessionManager } from "./session-manager.js";
import type { AgentStore } from "./store.js";
import { runSubagent, specialistDefinition } from "./subagent-run.js";

interface PrimaryRunInput {
  reviewCommand(): CommandInvocation | undefined;
  command?: CommandInvocation;
  contextTokens: number | "auto";
  knownContextTokens?: number;
  database: DatabasePort;
  definitions: MarkdownDefinitionLibrary;
  history: { messages: ConversationMessage[]; summary?: string };
  jobs: JobStore;
  run: AgentRunSummary;
  sessions: AgentSessionManager;
  signal: AbortSignal;
  store: AgentStore;
  task: string;
  thinking: ThinkingLevel;
  chat: InferenceService["chat"];
  modelId: string;
  inspectImage(path: string, prompt: string): Promise<string>;
  modelNeedsLoad: boolean;
  onThinking(thinking: string | null): void;
  onResponse(response: string | null): void;
  onSessionTitle(title: string): void;
  onContext(used: number, allocated: number, measured?: boolean): void;
  askQuestion(questions: AgentQuestion[]): Promise<AgentQuestionOutcome>;
}

function thinkingCallbacks(input: PrimaryRunInput) {
  let event: AgentEvent | undefined;
  let received = false;
  let recorded = false;
  const complete = () => {
    if (event === undefined || !received || recorded) return;
    input.store.recordEventDuration(event.id, Date.now() - Date.parse(event.createdAt));
    recorded = true;
  };
  return {
    onEvent(type: AgentEventType, summary: string, detail?: Partial<AgentEventDetail>) {
      if (type === "inference.started") {
        complete();
        event = input.store.appendEvent(input.run.id, type, summary, detail);
        received = false;
        recorded = false;
        return;
      }
      input.store.appendEvent(input.run.id, type, summary, detail);
    },
    onThinking(value: string | null) {
      if (value === null) complete();
      else if (value.length > 0) received = true;
      input.onThinking(value);
    },
    onResponse(value: string | null) {
      if (value !== null && value.trim().length > 0) complete();
      input.onResponse(value);
    },
  };
}

/** Resolves a command that names a specialist. The specialist runs in this run, not in a child. */
function commandSpecialist(input: PrimaryRunInput) {
  const command = input.command;
  if (command?.agent === undefined) return undefined;
  const agent = input.definitions.agent(command.agent);
  if (agent.mode !== "subagent") throw new Error("command_agent_invalid");
  return { agent, task: `${command.description}\n\n${command.arguments || command.description}` };
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: keep the primary agent input mapping together.
export async function runPrimaryAgent(input: PrimaryRunInput): Promise<AgentRunResult> {
  const { definitions, run, store } = input;
  const thinking = thinkingCallbacks(input);
  const primary = definitions.agent("primary");
  const specialist = commandSpecialist(input);
  const attachments = store.listAttachments(run.sessionId).map((item, index) => ({
    path: `/run/attachments/${guestAttachmentName(index, item.name)}`,
    displayName: item.name,
    mediaType: item.mediaType,
  }));
  const agentInput: ChatAgentInput = {
    agent: primary,
    contextTokens: input.contextTokens,
    ...(input.knownContextTokens === undefined
      ? {}
      : { knownContextTokens: input.knownContextTokens }),
    executor: createRunExecutor({
      runId: run.id,
      sessionId: run.sessionId,
      store,
      sessions: input.sessions,
    }),
    ...(specialist === undefined ? { history: input.history } : {}),
    inspectImage: input.inspectImage,
    reviewDocument: (path, prompt, toolCallId) => {
      const review = input.reviewCommand();
      if (review === undefined) throw new Error("command_not_found");
      return runInternalReview({
        ports: {
          database: input.database,
          jobs: input.jobs,
          parentRunId: run.id,
          sessionId: run.sessionId,
          sessions: input.sessions,
          store,
          ...(toolCallId === undefined ? {} : { toolCallId }),
        },
        command: { ...review, arguments: prompt },
        input: agentInput,
        chat: input.chat,
        path,
      });
    },
    attachments,
    modelId: input.modelId,
    modelNeedsLoad: input.modelNeedsLoad,
    onEvent: thinking.onEvent,
    onThinking: thinking.onThinking,
    onResponse: thinking.onResponse,
    onSessionTitle: input.onSessionTitle,
    onContext: input.onContext,
    askQuestion: input.askQuestion,
    signal: input.signal,
    subagents: definitions.agents.filter((agent) => agent.mode === "subagent"),
    skills: agentSkillReader(definitions, primary),
    spawnTask: (request) => runPrimarySubagent(input, request),
    systemPrompt: (name) => definitions.system(name),
    task: input.task,
    thinking: input.thinking,
    trace: { runId: run.id, store: store.trace },
  };
  const runAgent = (request: ChatAgentInput) =>
    new ChatAgentLoop({ chat: input.chat }).run(request);
  if (specialist !== undefined) {
    const { askQuestion, inspectImage, reviewDocument, spawnTask, subagents, ...base } = agentInput;
    return runAgent({
      ...base,
      ...(specialist.agent.tools.includes("image") ? { inspectImage } : {}),
      agent: specialistDefinition(definitions, specialist.agent, run.id, "user"),
      skills: agentSkillReader(definitions, specialist.agent),
      task: specialist.task,
    });
  }
  return input.command === undefined
    ? runAgent(agentInput)
    : runCommand(input.command, agentInput, input.chat, runAgent);
}

async function runPrimarySubagent(
  input: PrimaryRunInput,
  request: Parameters<typeof runSubagent>[1],
): Promise<AgentRunResult> {
  return await runSubagent(
    {
      contextTokens: input.contextTokens,
      ...(input.knownContextTokens === undefined
        ? {}
        : { knownContextTokens: input.knownContextTokens }),
      database: input.database,
      inference: { chat: input.chat },
      inspectImage: input.inspectImage,
      jobs: input.jobs,
      library: input.definitions,
      modelId: input.modelId,
      parentRunId: input.run.id,
      sessionId: input.run.sessionId,
      sessions: input.sessions,
      signal: input.signal,
      store: input.store,
      thinking: input.thinking,
    },
    request,
  );
}
