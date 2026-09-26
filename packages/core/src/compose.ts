import { resolve } from "node:path";
import type { InferenceProfile, WorkspaceStatus } from "@gardendesk/shared";
import { createCodeAgentLauncher } from "./agent/launcher.js";
import { MarkdownDefinitionLibrary } from "./agent/markdown-definition-library.js";
import { AgentService } from "./agent/service.js";
import { SkillStore } from "./agent/skill-store.js";
import { AgentStore } from "./agent/store.js";
import { AuditLog } from "./audit/log.js";
import { CommandLibrary } from "./commands/library.js";
import { createConversationPorts } from "./conversation-ports.js";
import { warmConversationSession } from "./conversations/lifecycle.js";
import { ConversationStore } from "./conversations/store.js";
import type { DevelopmentPorts } from "./development/ports.js";
import { createFacade, type GardenDeskCore } from "./facade.js";
import { JobStore } from "./jobs/jobs.js";
import { createInferenceService, unavailableInference } from "./runtime/compose.js";
import type { InferenceSupervisor } from "./runtime/supervisor.js";
import { createSkillPorts } from "./skill-ports.js";
import { ArtifactStore } from "./workspace/artifacts.js";
import { openWorkspaceCatalog } from "./workspace/catalog.js";
import { WorkspaceScope } from "./workspace/scope.js";
import { getOrCreateWorkspace } from "./workspace/workspaces.js";

export interface GardenDeskCoreOptions {
  workspaceDir: string;
  modelStoreDir: string;
  profile: InferenceProfile;
  migrationDirectory?: string;
  sessionsOnly?: boolean;
  workerEntryPath?: string;
  inferenceHelperPath?: string;
  inferenceRuntimePath?: string;
  agentHelperPath?: string;
  agentImageRoot?: string;
  promptDirectory?: string;
}

interface CoreServices {
  commands: CommandLibrary;
  catalog: ReturnType<typeof openWorkspaceCatalog>;
  workspace: WorkspaceStatus["workspace"];
  audit: AuditLog;
  jobs: JobStore;
  conversations: ConversationStore;
  agentStore: AgentStore;
  inference: InferenceSupervisor | ReturnType<typeof unavailableInference>;
  skills: SkillStore;
  agent?: AgentService;
  development?: DevelopmentPorts;
}

/** Development builds only: production bundling removes this branch and the cloud modules. */
async function developmentPorts(
  workspaceRoot: string,
  audit: AuditLog,
): Promise<DevelopmentPorts | undefined> {
  if (globalThis.__GARDEN_DESK_DEVELOPMENT_BUILD__ === true) {
    const { createDevelopmentPorts } = await import("./development/ports.js");
    return createDevelopmentPorts(workspaceRoot, (event) => audit.append(event));
  }
  return undefined;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: facade assembly intentionally lists every public capability.
function assembleGardenDeskCore(services: CoreServices): GardenDeskCore {
  const { catalog, workspace, audit, jobs, conversations, agentStore, inference, agent } = services;
  const unavailableAgent = (): never => {
    throw Object.assign(new Error("agent_not_packaged"), { code: "unsupported" });
  };
  audit.append({ type: "core.opened", outcome: "succeeded", metadata: {} });
  return createFacade({
    ...(services.development === undefined ? {} : { development: services.development }),
    listCommands: async () => services.commands.list(),
    ...createSkillPorts(services.skills, audit),
    status: async () => ({
      workspace,
      catalogSchemaVersion: catalog.schemaVersion,
      protocolVersion: 1,
      status: "ok",
    }),
    ...createConversationPorts(conversations, audit, catalog.database, agent),
    async saveDraft(sessionId, content) {
      return agent?.saveDraft(sessionId, content) ?? unavailableAgent();
    },
    async loadDraft(sessionId) {
      return agent?.loadDraft(sessionId) ?? unavailableAgent();
    },
    async addAttachment(sessionId, path) {
      return (await agent?.addAttachment(sessionId, path)) ?? unavailableAgent();
    },
    async listAttachments(sessionId) {
      return agent?.listAttachments(sessionId) ?? unavailableAgent();
    },
    async materializeAttachment(sessionId, attachmentId) {
      return (await agent?.materializeAttachment(sessionId, attachmentId)) ?? unavailableAgent();
    },
    async materializeArtifact(sessionId, artifactId) {
      return (await agent?.materializeArtifact(sessionId, artifactId)) ?? unavailableAgent();
    },
    async recordArtifactOpen(sessionId, artifactId, outcome) {
      const activeAgent = agent ?? unavailableAgent();
      await activeAgent.recordArtifactOpen(sessionId, artifactId, outcome);
    },
    async exportArtifact(sessionId, artifactId, destination) {
      const activeAgent = agent ?? unavailableAgent();
      await activeAgent.exportArtifact(sessionId, artifactId, destination);
    },
    async removeAttachment(sessionId, attachmentId) {
      return agent?.removeAttachment(sessionId, attachmentId) ?? unavailableAgent();
    },
    async startAgent(sessionId, task, thinking, developmentModelId) {
      return agent?.start(sessionId, task, thinking, developmentModelId) ?? unavailableAgent();
    },
    async listAgentRuns(sessionId) {
      return agent?.listRuns(sessionId) ?? unavailableAgent();
    },
    async getAgentRun(runId) {
      return agent?.snapshot(runId) ?? unavailableAgent();
    },
    getAgentTrace: async (runId) => agentStore.trace.get(runId),
    async cancelAgent(jobId) {
      return agent?.cancel(jobId) ?? false;
    },
    async answerQuestion(runId, questionId, answers) {
      return agent?.settleQuestion(runId, questionId, answers) ?? false;
    },
    async dismissQuestion(runId, questionId) {
      return agent?.settleQuestion(runId, questionId, undefined) ?? false;
    },
    async cancelJob(jobId) {
      const cancelled = agent?.cancel(jobId) ?? jobs.cancel(jobId) !== undefined;
      audit.append({
        type: "job.cancellation_requested",
        outcome: cancelled ? "succeeded" : "failed",
        metadata: { jobId },
      });
      return cancelled;
    },
    verifyAudit: async () => audit.verify(),
    generate: (input, signal, onThinkingDelta, identity) =>
      inference.generate(input, signal, onThinkingDelta, identity),
    chat: (input, signal, streams, identity) => inference.chat(input, signal, streams, identity),
    embed: (input, signal) => inference.embed(input, signal),
    inspectImage: (input, signal) => inference.inspectImage(input, signal),
    modelStatus: () => inference.modelStatus(),
    unloadModel: () => inference.unloadModel(),
    async close() {
      await agent?.close();
      await inference.close();
      audit.append({ type: "core.closed", outcome: "succeeded", metadata: {} });
      catalog.close();
    },
  });
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: composition remains one explicit authority wiring boundary.
export async function createGardenDeskCore(
  options: GardenDeskCoreOptions,
): Promise<GardenDeskCore> {
  const promptDirectory = resolve(options.promptDirectory ?? "prompts");
  const commands = new CommandLibrary(resolve(promptDirectory, "commands"));
  const scope = await WorkspaceScope.create(resolve(options.workspaceDir));
  const workspaceRoot = scope.root;
  const skills = new SkillStore(promptDirectory, resolve(workspaceRoot, "skills"));
  const catalog = openWorkspaceCatalog(workspaceRoot, {
    ...(options.migrationDirectory === undefined
      ? {}
      : { migrationDirectory: options.migrationDirectory }),
  });
  const workspace = getOrCreateWorkspace(catalog.database, workspaceRoot);
  const audit = new AuditLog(catalog.database);
  const jobs = new JobStore(catalog.database);
  const conversations = new ConversationStore(catalog.database);
  const artifacts = await ArtifactStore.create(scope);
  const agentStore = new AgentStore(catalog.database, artifacts, (event) => audit.append(event));
  agentStore.recoverInterrupted();
  const development = await developmentPorts(workspaceRoot, audit);
  let inference: InferenceSupervisor | ReturnType<typeof unavailableInference>;
  let inferenceAvailable = false;
  let agentSessionCapacity = 0;
  try {
    const configured =
      options.sessionsOnly === true
        ? { service: unavailableInference(), available: false as const, agentSessionCapacity: 0 }
        : await createInferenceService(options, workspaceRoot, audit);
    inference = configured.service;
    inferenceAvailable = configured.available;
    agentSessionCapacity = configured.agentSessionCapacity;
  } catch (error) {
    catalog.close();
    throw error;
  }
  const agent =
    options.sessionsOnly === true || !inferenceAvailable || options.agentHelperPath === undefined
      ? undefined
      : new AgentService(
          catalog.database,
          agentStore,
          conversations,
          jobs,
          artifacts,
          inference,
          createCodeAgentLauncher(
            options.agentHelperPath,
            options.agentImageRoot,
            resolve(workspaceRoot, ".garden-desk", "agent-workspaces"),
          ),
          audit,
          agentSessionCapacity,
          new MarkdownDefinitionLibrary(promptDirectory, skills),
          commands,
          development,
        );
  const restoredSessionId = conversations.mostRecentSessionId();
  if (agent !== undefined && restoredSessionId !== undefined) {
    warmConversationSession(agent, audit, restoredSessionId);
  }
  return assembleGardenDeskCore({
    commands,
    catalog,
    workspace,
    audit,
    jobs,
    conversations,
    agentStore,
    inference,
    skills,
    ...(development === undefined ? {} : { development }),
    ...(agent === undefined ? {} : { agent }),
  });
}
