import type {
  AgentRunSummary,
  AttachmentSummary,
  ConversationMessage,
  SessionSummary,
  ThinkingLevel,
} from "@gardendesk/shared";
import {
  AgentRunSnapshotSchema,
  AgentRunSummarySchema,
  AgentTraceSchema,
  AttachmentSummarySchema,
  ConversationMessageSchema,
  INFERENCE_PROFILE,
  SessionDraftSchema,
  SessionSummarySchema,
} from "@gardendesk/shared";
import type { DesktopApi, NativeDropEvent } from "../../packages/desktop/src/api.js";
import { contentHash, listenForBrowserDrops, pickFiles } from "./demo-files.js";
import { REVIEW_DURATION_MS, type ReviewRun, reviewProgress, uuid } from "./review-run.js";
import { reviewScript } from "./review-script.js";

const demoUnavailable = () => Promise.reject(new Error("Unavailable in the demo"));
const CONTEXT_TOKENS = 65_536;

interface DemoRun extends ReviewRun {
  sessionId: string;
  jobId: string;
  prompt: string;
  answered: boolean;
}

export class DemoDesktopApi implements DesktopApi {
  private readonly attachments = new Map<string, AttachmentSummary[]>();
  private readonly drafts = new Map<string, string>();
  private readonly files = new Map<string, File>();
  private readonly messages = new Map<string, ConversationMessage[]>();
  private readonly runs = new Map<string, DemoRun>();
  private readonly sessions: SessionSummary[] = [];
  private sequence = 100;

  constructor(private readonly now: () => number = Date.now) {}

  async bootstrapDesktop() {
    return {
      catalogPath: "",
      commands: [],
      folders: [],
      globalSessions: { items: [], nextCursor: null },
      folderSessions: [],
      model: await this.getModelStatus(),
    };
  }

  async getSecureWorkspaceStatus() {
    return { state: "ready" as const };
  }

  async configureSecureWorkspace() {
    return { outcome: "not_needed" as const, status: { state: "ready" as const } };
  }

  async getModelStatus() {
    const runs = [...this.runs.values()];
    const busy = runs.some((run) => this.now() - run.startedAt < REVIEW_DURATION_MS);
    const idle = runs.length > 0 ? ("ready" as const) : ("unloaded" as const);
    return {
      modelId: INFERENCE_PROFILE.modelId,
      name: INFERENCE_PROFILE.name,
      state: busy ? ("busy" as const) : idle,
      thinkingSupported: true,
      contextSizeTokens: CONTEXT_TOKENS,
    };
  }

  unloadModel = demoUnavailable;
  chooseFolder = demoUnavailable;
  addFolders = demoUnavailable;
  reorderFolders = demoUnavailable;
  revokeFolder = demoUnavailable;
  openFolder = demoUnavailable;
  openCatalogFolder = demoUnavailable;
  deleteSession = demoUnavailable;
  renameSession = demoUnavailable;
  openArtifact = demoUnavailable;
  saveArtifact = demoUnavailable;
  answerQuestion = demoUnavailable;
  dismissQuestion = demoUnavailable;
  createDebugSnapshot = demoUnavailable;
  revealDebugSnapshot = demoUnavailable;
  openReleasePage = demoUnavailable;
  chooseSkillFiles = demoUnavailable;
  addSkillFiles = demoUnavailable;
  readSkill = demoUnavailable;
  writeSkill = demoUnavailable;
  removeSkill = demoUnavailable;
  setSkillEnabled = demoUnavailable;
  openPromptFolder = demoUnavailable;

  async listSkills() {
    return [];
  }

  async skillLocations() {
    return { builtInSkillsPath: "", skillsPath: "", systemPromptsPath: "" };
  }

  async listenForDroppedPaths(listener: (event: NativeDropEvent) => void) {
    return listenForBrowserDrops(listener, (files) => {
      for (const file of files) this.files.set(file.name, file);
    });
  }

  async classifyDroppedPaths(paths: string[]) {
    return { files: paths, folders: [] };
  }

  async chooseFiles(sessionId: string) {
    const picked = await pickFiles();
    for (const file of picked) this.files.set(file.name, file);
    return this.addFiles(sessionId, [...new Set(picked.map((file) => file.name))]);
  }

  async addFiles(sessionId: string, paths: string[]) {
    const files = paths.flatMap((name) => this.files.get(name) ?? []);
    const added = await Promise.all(
      files.map(async (file) =>
        AttachmentSummarySchema.parse({
          id: uuid(6, ++this.sequence),
          sessionId,
          name: file.name,
          mediaType: file.type || "application/octet-stream",
          byteLength: file.size,
          contentHash: await contentHash(file),
          createdAt: new Date(this.now()).toISOString(),
        }),
      ),
    );
    this.attachments.set(sessionId, [...(this.attachments.get(sessionId) ?? []), ...added]);
    return added;
  }

  async listAttachments(sessionId: string) {
    return [...(this.attachments.get(sessionId) ?? [])];
  }

  async openAttachment(sessionId: string, attachmentId: string) {
    const attachment = this.attachments.get(sessionId)?.find((item) => item.id === attachmentId);
    const file = attachment === undefined ? undefined : this.files.get(attachment.name);
    if (file !== undefined) window.open(URL.createObjectURL(file), "_blank", "noopener");
  }

  async removeAttachment(sessionId: string, attachmentId: string) {
    const kept = (this.attachments.get(sessionId) ?? []).filter((item) => item.id !== attachmentId);
    this.attachments.set(sessionId, kept);
    return true;
  }

  async createSession(folderId: string | null) {
    const time = new Date(this.now()).toISOString();
    const session = SessionSummarySchema.parse({
      id: uuid(2, ++this.sequence),
      folderId,
      title: "New chat",
      createdAt: time,
      updatedAt: time,
    });
    this.sessions.unshift(session);
    this.messages.set(session.id, []);
    return session;
  }

  async listSessions(folderId: string | null) {
    return {
      items: this.sessions.filter((session) => session.folderId === folderId),
      nextCursor: null,
    };
  }

  async listMessages(sessionId: string) {
    return [...(this.messages.get(sessionId) ?? [])];
  }

  async appendUserMessage(sessionId: string, content: string) {
    return this.addMessage(sessionId, "user", content, null);
  }

  async saveDraft(sessionId: string, content: string) {
    this.drafts.set(sessionId, content);
    return SessionDraftSchema.parse({
      sessionId,
      content,
      updatedAt: new Date(this.now()).toISOString(),
    });
  }

  async loadDraft(sessionId: string) {
    const content = this.drafts.get(sessionId);
    return content === undefined ? undefined : this.saveDraft(sessionId, content);
  }

  async startAgent(sessionId: string, task: string, thinking: ThinkingLevel) {
    const sequence = ++this.sequence;
    const run: DemoRun = {
      attachmentName: this.attachments.get(sessionId)?.at(-1)?.name ?? reviewScript().sampleFile,
      answered: false,
      jobId: uuid(10, sequence),
      prompt: task,
      runId: uuid(9, sequence),
      sequence,
      sessionId,
      startedAt: this.now(),
      thinking,
    };
    this.runs.set(run.runId, run);
    this.addMessage(sessionId, "user", task, run.runId);
    return this.summary(run, "queued", null);
  }

  async getAgentRun(runId: string) {
    const run = this.runs.get(runId);
    if (run === undefined) throw new Error("Unknown demo run");
    const progress = reviewProgress(run, this.now() - run.startedAt);
    if (progress.state === "succeeded" && !run.answered && progress.response !== null) {
      run.answered = true;
      this.addMessage(run.sessionId, "assistant", progress.response, run.runId);
    }
    return AgentRunSnapshotSchema.parse({
      run: this.summary(run, progress.state, progress.response),
      sessionTitle: run.prompt.replace(/\s+/g, " ").trim().slice(0, 60),
      events: progress.events,
      executions: progress.executions,
      artifacts: [],
      thinking: progress.thinking,
      contextUsedTokens: progress.contextUsedTokens,
      contextAllocatedTokens: progress.contextUsedTokens === null ? null : CONTEXT_TOKENS,
    });
  }

  async getAgentTrace(runId: string) {
    return AgentTraceSchema.parse({ runId, captureVersion: 0, status: "not_recorded", turns: [] });
  }

  async listAgentRuns(sessionId: string) {
    const runs = [...this.runs.values()].filter((run) => run.sessionId === sessionId);
    return Promise.all(runs.map(async (run) => (await this.getAgentRun(run.runId)).run));
  }

  async cancelAgent() {
    return false;
  }

  private summary(
    run: DemoRun,
    state: AgentRunSummary["state"],
    response: string | null,
  ): AgentRunSummary {
    return AgentRunSummarySchema.parse({
      id: run.runId,
      sessionId: run.sessionId,
      jobId: run.jobId,
      state,
      response,
      error: null,
      performance:
        state === "succeeded"
          ? {
              promptTokens: 7_412,
              outputTokens: 846,
              tokensPerSecond: 26.4,
              promptTokensPerSecond: 352.8,
              totalDurationMs: REVIEW_DURATION_MS,
              thinking: run.thinking,
            }
          : null,
      createdAt: new Date(run.startedAt).toISOString(),
      updatedAt: new Date(this.now()).toISOString(),
    });
  }

  private addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    runId: string | null,
  ): ConversationMessage {
    const message = ConversationMessageSchema.parse({
      id: uuid(5, ++this.sequence),
      sessionId,
      role,
      content,
      runId,
      createdAt: new Date(this.now()).toISOString(),
    });
    this.messages.set(sessionId, [...(this.messages.get(sessionId) ?? []), message]);
    return message;
  }
}
