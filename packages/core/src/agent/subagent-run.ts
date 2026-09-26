import { randomUUID } from "node:crypto";
import type { AgentRunResult, AgentRunSummary, ThinkingLevel } from "@gardendesk/shared";
import type { JobStore } from "../jobs/jobs.js";
import { fillPrompt } from "../prompt-files.js";
import type { InferenceService } from "../runtime/inference.js";
import type { DatabasePort } from "../workspace/database.js";
import { agentInstructions, agentSkillReader } from "./agent-skills.js";
import { ChatAgentLoop } from "./chat-loop.js";
import type { SubagentRequest } from "./generic-tools.js";
import { guestAttachmentName } from "./inputs.js";
import type { AgentDefinition, MarkdownDefinitionLibrary } from "./markdown-definition-library.js";
import { createRunExecutor } from "./service-executor.js";
import { runPerformance } from "./service-results.js";
import type { AgentSessionManager } from "./session-manager.js";
import type { AgentStore } from "./store.js";

interface SubagentPorts {
  contextTokens: number | "auto";
  knownContextTokens?: number;
  database: DatabasePort;
  inference: Pick<InferenceService, "chat">;
  inspectImage(path: string, prompt: string): Promise<string>;
  jobs: JobStore;
  library: MarkdownDefinitionLibrary;
  modelId: string;
  parentRunId: string;
  sessionId: string;
  sessions: AgentSessionManager;
  signal: AbortSignal;
  store: AgentStore;
  thinking?: ThinkingLevel;
  userRequest: string;
}

function createChild(ports: SubagentPorts, request: SubagentRequest) {
  const assignment = `${request.description}\n\n${request.prompt}`;
  return ports.database.transaction(() => {
    const job = ports.jobs.create("agent", randomUUID());
    const run = ports.store.createRun(ports.sessionId, job.id, ports.parentRunId, {
      agentId: request.subagentType,
      assignment,
      parentToolCallId: request.parentToolCallId ?? null,
    });
    ports.jobs.transition(job.id, "running");
    ports.store.transitionRun(run.id, { state: "running" });
    ports.store.appendEvent(run.id, "run.started", request.description);
    return { ...run, assignment };
  })();
}

function failChild(
  ports: SubagentPorts,
  child: ReturnType<typeof createChild>,
  error: unknown,
): void {
  const cancelled = ports.signal.aborted;
  const detail = error instanceof Error ? error.message : "subagent_failed";
  ports.database.transaction(() => {
    ports.store.execution.failIncomplete(child.id, cancelled);
    ports.store.transitionRun(child.id, {
      state: cancelled ? "cancelled" : "failed",
      error: detail,
    });
    if (cancelled) ports.jobs.cancel(child.jobId);
    else ports.jobs.transition(child.jobId, "failed");
    ports.store.appendEvent(
      child.id,
      cancelled ? "run.cancelled" : "run.failed",
      cancelled ? "Task cancelled." : "Sub-agent failed.",
      { stderr: detail },
    );
  })();
}

/** Adds the specialist rules, the working directory, and the output owner to a packaged agent. */
export function specialistDefinition(
  library: MarkdownDefinitionLibrary,
  definition: AgentDefinition,
  runId: string,
  outputOwner: "parent" | "user",
): AgentDefinition {
  const body = agentInstructions(library, definition);
  if (["general", "explore"].includes(definition.name)) return { ...definition, body };
  const workDirectory = `/workspace/.garden-desk-tools/${runId}`;
  const ownership = library.system(
    outputOwner === "user" ? "specialist-user-output" : "specialist-parent-output",
  );
  return {
    ...definition,
    body: `${body}\n\n${library.system("specialist")}\n\nWorking directory: ${workDirectory}\n${ownership}`,
  };
}

function completeChild(ports: SubagentPorts, child: AgentRunSummary, result: AgentRunResult): void {
  ports.database.transaction(() => {
    ports.store.transitionRun(child.id, {
      state: "succeeded",
      response: result.response,
      performance: runPerformance(result, child.createdAt),
    });
    ports.jobs.transition(child.jobId, "succeeded");
  })();
}

export async function runSubagent(
  ports: SubagentPorts,
  request: SubagentRequest,
): Promise<AgentRunResult> {
  const definition = ports.library.agent(request.subagentType);
  const child = createChild(ports, request);
  try {
    const result = await new ChatAgentLoop(ports.inference).run({
      agent: specialistDefinition(ports.library, definition, child.id, "parent"),
      contextTokens: ports.contextTokens,
      ...(ports.knownContextTokens === undefined
        ? {}
        : { knownContextTokens: ports.knownContextTokens }),
      executor: createRunExecutor({
        runId: child.id,
        sessionId: ports.sessionId,
        store: ports.store,
        sessions: ports.sessions,
      }),
      modelId: ports.modelId,
      attachments: ports.store.listAttachments(ports.sessionId).map((item, index) => ({
        path: `/run/attachments/${guestAttachmentName(index, item.name)}`,
        displayName: item.name,
        mediaType: item.mediaType,
      })),
      onEvent: (type, summary, detail) => ports.store.appendEvent(child.id, type, summary, detail),
      onThinking: (thinking) => ports.store.live.setThinking(child.id, thinking),
      onResponse: (response) => {
        ports.store.live.setResponse(child.id, response);
      },
      onContext: (used, allocated) => {
        ports.store.setContext(child.id, used, allocated);
      },
      signal: ports.signal,
      ...(ports.thinking === undefined ? {} : { thinking: ports.thinking }),
      inferencePriority: "secondary",
      ...(definition.tools.includes("image") ? { inspectImage: ports.inspectImage } : {}),
      skills: agentSkillReader(ports.library, definition),
      systemPrompt: (name) => ports.library.system(name),
      task: `${child.assignment}\n\n${fillPrompt(ports.library.system("child-user-request"), { request: ports.userRequest })}`,
      trace: { runId: child.id, store: ports.store.trace },
    });
    completeChild(ports, child, result);
    return result;
  } catch (error) {
    failChild(ports, child, error);
    throw error;
  }
}
