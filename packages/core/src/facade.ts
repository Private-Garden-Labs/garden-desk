import type {
  AgentRunSnapshot,
  AgentRunSummary,
  AgentTrace,
  AttachmentSummary,
  CommandSummary,
  CompanyPackImport,
  CompanyPacks,
  ConversationMessage,
  DataPacks,
  FolderSummary,
  Jurisdiction,
  LawAct,
  LawCitations,
  LawJurisdictionSummary,
  MessageRole,
  SessionDraft,
  SessionPage,
  SessionSummary,
  SkillLocations,
  SkillSummary,
  ThinkingLevel,
  WorkspaceStatus,
} from "@gardendesk/shared";
import type { CompanyPackRequest } from "./laws/company-pack-build.js";
import type {
  ChatInput,
  EmbeddingInput,
  GenerationInput,
  ImageInspectionInput,
  InferenceService,
} from "./runtime/inference.js";

export interface GardenDeskCorePorts extends InferenceService {
  status(): Promise<WorkspaceStatus>;
  listCommands(): Promise<CommandSummary[]>;
  addFolder(rootPath: string): Promise<FolderSummary>;
  listFolders(): Promise<FolderSummary[]>;
  reorderFolders(folderIds: string[]): Promise<FolderSummary[]>;
  resolveFolderPath(folderId: string): Promise<string>;
  sampleFolderFiles(folderId: string): Promise<string[]>;
  revokeFolder(folderId: string): Promise<boolean>;
  createSession(folderId: string | null): Promise<SessionSummary>;
  deleteSession(sessionId: string): Promise<boolean>;
  renameSession(sessionId: string, title: string): Promise<boolean>;
  listSessions(folderId: string | null, cursor?: string, limit?: number): Promise<SessionPage>;
  appendMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
  ): Promise<ConversationMessage>;
  listMessages(sessionId: string): Promise<ConversationMessage[]>;
  saveDraft(sessionId: string, content: string): Promise<SessionDraft>;
  loadDraft(sessionId: string): Promise<SessionDraft | undefined>;
  addAttachment(sessionId: string, path: string): Promise<AttachmentSummary>;
  listAttachments(sessionId: string): Promise<AttachmentSummary[]>;
  materializeAttachment(sessionId: string, attachmentId: string): Promise<string>;
  materializeArtifact(sessionId: string, artifactId: string): Promise<string>;
  recordArtifactOpen(
    sessionId: string,
    artifactId: string,
    outcome: "failed" | "succeeded",
  ): Promise<void>;
  exportArtifact(sessionId: string, artifactId: string, destination: string): Promise<void>;
  removeAttachment(sessionId: string, attachmentId: string): Promise<boolean>;
  startAgent(
    sessionId: string,
    task: string,
    thinking: ThinkingLevel,
    options: { jurisdiction: Jurisdiction | null; replyLanguage?: string },
  ): Promise<AgentRunSummary>;
  listAgentRuns(sessionId: string): Promise<AgentRunSummary[]>;
  getAgentRun(runId: string): Promise<AgentRunSnapshot>;
  getAgentTrace(runId: string): Promise<AgentTrace>;
  cancelAgent(jobId: string): Promise<boolean>;
  answerQuestion(runId: string, questionId: string, answers: string[][]): Promise<boolean>;
  dismissQuestion(runId: string, questionId: string): Promise<boolean>;
  cancelJob(jobId: string): Promise<boolean>;
  listSkills(): Promise<SkillSummary[]>;
  installSkills(paths: string[]): Promise<SkillSummary[]>;
  readSkill(name: string): Promise<string>;
  writeSkill(name: string, content: string): Promise<boolean>;
  removeSkill(name: string): Promise<boolean>;
  setSkillEnabled(name: string, enabled: boolean): Promise<boolean>;
  skillLocations(): Promise<SkillLocations>;
  listLaws(): Promise<LawJurisdictionSummary[]>;
  readLaw(id: Jurisdiction, source: string): Promise<LawAct | undefined>;
  lawCitations(): Promise<LawCitations>;
  lawSourceUrl(id: Jurisdiction, source: string): Promise<string | undefined>;
  setLawEnabled(id: Jurisdiction, enabled: boolean, source?: string): Promise<boolean>;
  listDataPacks(): Promise<DataPacks>;
  saveDataPackKey(key: string): Promise<boolean>;
  installDataPack(id: string): Promise<boolean>;
  companyPackStatus(): Promise<CompanyPacks>;
  setCompanyPackFolder(path: string): Promise<void>;
  importCompanyPack(path: string, trust?: string): Promise<CompanyPackImport>;
  buildCompanyPack(request: CompanyPackRequest): Promise<boolean>;
  verifyAudit(): Promise<boolean>;
  close(): Promise<void>;
}

export interface GardenDeskCore extends GardenDeskCorePorts {}

function artifactPorts(ports: GardenDeskCorePorts) {
  return {
    materializeArtifact: (sessionId: string, artifactId: string) =>
      ports.materializeArtifact(sessionId, artifactId),
    recordArtifactOpen: (sessionId: string, artifactId: string, outcome: "failed" | "succeeded") =>
      ports.recordArtifactOpen(sessionId, artifactId, outcome),
    exportArtifact: (sessionId: string, artifactId: string, destination: string) =>
      ports.exportArtifact(sessionId, artifactId, destination),
  };
}

function skillPorts(ports: GardenDeskCorePorts) {
  return {
    listSkills: () => ports.listSkills(),
    installSkills: (paths: string[]) => ports.installSkills(paths),
    readSkill: (name: string) => ports.readSkill(name),
    writeSkill: (name: string, content: string) => ports.writeSkill(name, content),
    removeSkill: (name: string) => ports.removeSkill(name),
    setSkillEnabled: (name: string, enabled: boolean) => ports.setSkillEnabled(name, enabled),
    skillLocations: () => ports.skillLocations(),
    listLaws: () => ports.listLaws(),
    readLaw: (id: Jurisdiction, source: string) => ports.readLaw(id, source),
    lawCitations: () => ports.lawCitations(),
    lawSourceUrl: (id: Jurisdiction, source: string) => ports.lawSourceUrl(id, source),
    setLawEnabled: (id: Jurisdiction, enabled: boolean, source?: string) =>
      ports.setLawEnabled(id, enabled, source),
    listDataPacks: () => ports.listDataPacks(),
    saveDataPackKey: (key: string) => ports.saveDataPackKey(key),
    installDataPack: (id: string) => ports.installDataPack(id),
    companyPackStatus: () => ports.companyPackStatus(),
    setCompanyPackFolder: (path: string) => ports.setCompanyPackFolder(path),
    importCompanyPack: (path: string, trust?: string) => ports.importCompanyPack(path, trust),
    buildCompanyPack: (request: CompanyPackRequest) => ports.buildCompanyPack(request),
  };
}

function inferencePorts(ports: GardenDeskCorePorts) {
  return {
    generate: (
      input: GenerationInput,
      signal?: AbortSignal,
      onThinkingDelta?: (text: string) => void,
      identity?: Parameters<InferenceService["generate"]>[3],
    ) => ports.generate(input, signal, onThinkingDelta, identity),
    chat: (
      input: ChatInput,
      signal?: AbortSignal,
      streams?: Parameters<InferenceService["chat"]>[2],
      identity?: Parameters<InferenceService["chat"]>[3],
    ) => ports.chat(input, signal, streams, identity),
    embed: (input: EmbeddingInput, signal?: AbortSignal) => ports.embed(input, signal),
    inspectImage: (input: ImageInspectionInput, signal?: AbortSignal) =>
      ports.inspectImage(input, signal),
    modelStatus: () => ports.modelStatus(),
    unloadModel: () => ports.unloadModel(),
  };
}

export function createFacade(ports: GardenDeskCorePorts): GardenDeskCore {
  return {
    status: () => ports.status(),
    listCommands: () => ports.listCommands(),
    addFolder: (rootPath) => ports.addFolder(rootPath),
    listFolders: () => ports.listFolders(),
    reorderFolders: (folderIds) => ports.reorderFolders(folderIds),
    resolveFolderPath: (folderId) => ports.resolveFolderPath(folderId),
    sampleFolderFiles: (folderId) => ports.sampleFolderFiles(folderId),
    revokeFolder: (folderId) => ports.revokeFolder(folderId),
    createSession: (folderId) => ports.createSession(folderId),
    deleteSession: (sessionId) => ports.deleteSession(sessionId),
    renameSession: (sessionId, title) => ports.renameSession(sessionId, title),
    listSessions: (folderId, cursor, limit) => ports.listSessions(folderId, cursor, limit),
    appendMessage: (sessionId, role, content) => ports.appendMessage(sessionId, role, content),
    listMessages: (sessionId) => ports.listMessages(sessionId),
    saveDraft: (sessionId, content) => ports.saveDraft(sessionId, content),
    loadDraft: (sessionId) => ports.loadDraft(sessionId),
    addAttachment: (sessionId, path) => ports.addAttachment(sessionId, path),
    listAttachments: (sessionId) => ports.listAttachments(sessionId),
    materializeAttachment: (sessionId, attachmentId) =>
      ports.materializeAttachment(sessionId, attachmentId),
    ...artifactPorts(ports),
    removeAttachment: (sessionId, attachmentId) => ports.removeAttachment(sessionId, attachmentId),
    startAgent: (sessionId, task, thinking, options) =>
      ports.startAgent(sessionId, task, thinking, options),
    listAgentRuns: (sessionId) => ports.listAgentRuns(sessionId),
    getAgentRun: (runId) => ports.getAgentRun(runId),
    getAgentTrace: (runId) => ports.getAgentTrace(runId),
    cancelAgent: (jobId) => ports.cancelAgent(jobId),
    answerQuestion: (runId, questionId, answers) =>
      ports.answerQuestion(runId, questionId, answers),
    dismissQuestion: (runId, questionId) => ports.dismissQuestion(runId, questionId),
    cancelJob: (jobId) => ports.cancelJob(jobId),
    ...skillPorts(ports),
    verifyAudit: () => ports.verifyAudit(),
    ...inferencePorts(ports),
    close: () => ports.close(),
  };
}
