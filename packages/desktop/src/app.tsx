import {
  type AgentRunSummary,
  DEFAULT_THINKING_LEVEL,
  type ThinkingLevel,
} from "@gardendesk/shared";
import { useEffect, useReducer, useState } from "react";
import type { DesktopApi } from "./api.js";
import { useAppearance } from "./appearance.js";
import { artifactActions } from "./artifact-actions.js";
import type { DesktopCapabilities } from "./capabilities.js";
import { AppChatControls } from "./components/app-chat-controls.js";
import { AppChatHeader } from "./components/app-chat-header.js";
import { AppSidebar } from "./components/app-sidebar.js";
import { ActiveConfirmation, type ConfirmationRequest } from "./components/confirmation.js";
import { Conversation } from "./components/conversation.js";
import { DropOverlay } from "./components/drop-overlay.js";
import { ErrorBanner } from "./components/error-banner.js";
import { GuidedExamples } from "./components/guided-examples.js";
import { SecureWorkspaceBanner } from "./components/secure-workspace-banner.js";
import { SkillsPage } from "./components/skills-page.js";
import { SpecialistView } from "./components/specialist-view.js";
import { TechnicalDetails } from "./components/technical-details.js";
import { openAttachment, send } from "./desktop-actions.js";
import { type DropIntent, useNativeDrop } from "./desktop-drop.js";
import { initialModelStatus, unloadModel, useModelRefresh } from "./desktop-model.js";
import { useDraftPersistence } from "./draft-persistence.js";
import { desktopPlatform } from "./platform.js";
import { secureWorkspaceAllowsTasks } from "./secure-workspace.js";
import { useSkills } from "./skills.js";
import { useDesktopBootstrap } from "./startup.js";
import { desktopReducer, initialDesktopState } from "./state.js";
import { selectStep } from "./step-selection.js";
import { agentSteps, desktopThinking } from "./steps.js";
import { useChildRun } from "./use-child-run.js";
import { useSecureWorkspace } from "./use-secure-workspace.js";
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: single desktop composition boundary.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: single desktop composition boundary.
export function App({ api, capabilities }: { api: DesktopApi; capabilities: DesktopCapabilities }) {
  const appearance = useAppearance();
  const [state, dispatch] = useReducer(desktopReducer, initialDesktopState);
  const [desktopError, setDesktopError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<AgentRunSummary>();
  useEffect(() => {
    setSelectedChild((current) =>
      current?.sessionId === state.activeSessionId ? current : undefined,
    );
  }, [state.activeSessionId]);
  const childOpen =
    selectedChild !== undefined && selectedChild.sessionId === state.activeSessionId;
  const child = useChildRun(api, childOpen ? selectedChild : undefined);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest>();
  const [dropIntent, setDropIntent] = useState<DropIntent>();
  const [model, setModel] = useState(initialModelStatus);
  const [appVersion, setAppVersion] = useState<string>();
  const [thinking, setThinking] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL);
  const secureWorkspace = useSecureWorkspace(api, setConfirmation, setDesktopError);
  useDesktopBootstrap({
    api,
    dispatch,
    setAppVersion,
    setError: setDesktopError,
    setModel,
  });
  const nativeUnavailable = capabilities.nativeActions
    ? undefined
    : (capabilities.unavailableReason ?? "Unavailable in the public demo");
  const generatedFileActions = artifactActions(api, state.activeSessionId, setDesktopError);
  const activeFolder = state.folders.find(
    (folder) =>
      folder.id === state.newSessionFolderId ||
      folder.sessions.some((session) => session.id === state.activeSessionId),
  );
  const folderName = activeFolder?.name;
  const running =
    submitting || state.activeRun?.state === "queued" || state.activeRun?.state === "running";
  useModelRefresh(api, state.loaded, running || model.state === "busy", setModel);
  const sessionLoading = state.pendingSessionId !== undefined;
  const desktopReady = state.loaded && !sessionLoading;
  const tasksAllowed = secureWorkspaceAllowsTasks(secureWorkspace.status);
  const draftPersistence = useDraftPersistence(api, setDesktopError);
  const skills = useSkills(api, skillsOpen);
  useNativeDrop({
    api,
    context: {
      activeSessionId: state.activeSessionId,
      draft: state.draft,
      newSessionFolderId: state.newSessionFolderId,
      running: running || sessionLoading,
      ...(skillsOpen ? { addSkills: skills.addPaths } : {}),
    },
    dispatch,
    enabled: capabilities.nativeActions && !childOpen,
    setDropIntent,
    setError: setDesktopError,
  });
  const changeDraft = (draft: string) => {
    dispatch({ type: "draft.change", draft });
    draftPersistence.schedule(state.activeSessionId, draft);
  };
  const runTask = (text: string) => {
    if (!tasksAllowed) {
      setDesktopError("Set up the secure workspace before starting a new task.");
      return;
    }
    draftPersistence.cancel();
    void send({
      api,
      text,
      thinking,
      activeSessionId: state.activeSessionId,
      newSessionFolderId: state.newSessionFolderId,
      dispatch,
      setError: setDesktopError,
      setSubmitting,
    });
  };
  const detailState = childOpen ? child.state : state;
  const detailDispatch = childOpen ? child.dispatch : dispatch;
  const steps = agentSteps(detailState.timeline, detailState.executions, detailState.traces);
  const { thinkingByStep, thinkingStepId } = desktopThinking(detailState);
  const cancelTask = () => {
    if (state.activeRun !== undefined) {
      void api
        .cancelAgent(state.activeRun.jobId)
        .catch(() => setDesktopError("The task could not be cancelled."));
    }
  };
  const closeChild = () => {
    const id = selectedChild?.id;
    setSelectedChild(undefined);
    setTechnicalDetailsOpen(false);
    requestAnimationFrame(() =>
      document.getElementById(`specialist-run-${id}`)?.focus({ preventScroll: true }),
    );
  };
  const onSelectStep = (stepId: string | undefined) =>
    selectStep(
      {
        api,
        dispatch: detailDispatch,
        openDetails: () => setTechnicalDetailsOpen(true),
        setError: setDesktopError,
        steps,
      },
      stepId,
    );
  return (
    <div
      className="app-shell"
      data-appearance={appearance.preference}
      data-platform={desktopPlatform(navigator.userAgent)}
      data-theme={appearance.resolved}
    >
      <AppSidebar
        api={api}
        appVersion={appVersion}
        dispatch={dispatch}
        dropIntent={dropIntent}
        nativeActionMessage={nativeUnavailable}
        onSkillsOpenChange={setSkillsOpen}
        setConfirmation={setConfirmation}
        setError={setDesktopError}
        skillsOpen={skillsOpen}
        state={state}
      />
      {skillsOpen ? (
        <SkillsPage
          controller={skills}
          dropActive={dropIntent !== undefined}
          nativeActionMessage={nativeUnavailable}
          onDone={() => setSkillsOpen(false)}
        />
      ) : (
        <main aria-busy={!desktopReady} className="workspace">
          <div aria-hidden="true" className="window-drag-region" data-tauri-drag-region="" />
          <AppChatHeader
            api={api}
            appearance={appearance.preference}
            dispatch={dispatch}
            model={model}
            nativeActionMessage={nativeUnavailable}
            onAppearanceChange={appearance.cycle}
            onTechnicalDetailsOpen={() => {
              detailDispatch({ type: "step.select", stepId: undefined });
              setTechnicalDetailsOpen(true);
            }}
            onUnload={() => void unloadModel(api, setModel, setDesktopError)}
            setError={setDesktopError}
            specialistAgentId={childOpen ? selectedChild.agentId : undefined}
            state={state}
            technicalDetailsOpen={technicalDetailsOpen}
          />
          <SecureWorkspaceBanner
            busy={secureWorkspace.busy}
            onSetup={secureWorkspace.showSetup}
            status={secureWorkspace.status}
          />
          <GuidedExamples
            disabled={!desktopReady || running || !tasksAllowed}
            examples={capabilities.guidedExamples ?? []}
            onRun={runTask}
          />
          <ErrorBanner message={desktopError} onDismiss={() => setDesktopError(undefined)} />
          <Conversation
            hidden={childOpen}
            childRuns={state.childRuns}
            onOpenChild={(run) => {
              dispatch({
                type: "step.select",
                stepId: state.timeline.find(
                  (item) =>
                    item.runId === run.parentRunId && item.toolCallId === run.parentToolCallId,
                )?.id,
              });
              setSelectedChild(run);
              setTechnicalDetailsOpen(false);
            }}
            artifacts={state.artifacts}
            attachments={state.attachments}
            folderName={folderName}
            key={state.activeSessionId ?? `new:${state.newSessionFolderId ?? "global"}`}
            nativeActionMessage={nativeUnavailable}
            ready={state.loaded}
            onOpenAttachment={(attachmentId) => {
              if (state.activeSessionId !== undefined)
                void openAttachment(api, state.activeSessionId, attachmentId, setDesktopError);
            }}
            onSuggestion={changeDraft}
            {...generatedFileActions}
            onSelectStep={onSelectStep}
            selectedStepId={state.selectedStepId}
            timeline={state.timeline}
            performance={state.activeRun?.performance ?? null}
            runId={state.activeRun?.id}
            thinkingByStep={desktopThinking(state).thinkingByStep}
            working={state.activeRun?.state === "queued" || state.activeRun?.state === "running"}
            activeRunState={state.activeRun?.state}
          />
          {childOpen ? (
            <SpecialistView
              key={selectedChild.id}
              run={selectedChild}
              state={child.state}
              unavailable={child.unavailable}
              onSelectStep={onSelectStep}
            />
          ) : null}
          <AppChatControls
            api={api}
            childOpen={childOpen}
            onBack={closeChild}
            disabled={!desktopReady || model.state === "unsupported" || !tasksAllowed}
            dispatch={dispatch}
            dropIntent={dropIntent}
            nativeActionMessage={nativeUnavailable}
            onCancel={cancelTask}
            onChange={changeDraft}
            onSend={runTask}
            running={running}
            setConfirmation={setConfirmation}
            setError={setDesktopError}
            state={state}
            thinking={thinking}
            onThinkingChange={setThinking}
          />
        </main>
      )}
      <TechnicalDetails
        artifacts={detailState.artifacts}
        catalogPath={state.catalogPath}
        executions={detailState.executions}
        folderId={state.activeSessionId === undefined ? undefined : activeFolder?.id}
        key={`${childOpen ? selectedChild.id : (state.activeSessionId ?? `new:${state.newSessionFolderId ?? "global"}`)}:${technicalDetailsOpen ? "open" : "closed"}`}
        api={api}
        model={model}
        nativeActionMessage={nativeUnavailable}
        onClose={() => setTechnicalDetailsOpen(false)}
        open={technicalDetailsOpen && !skillsOpen}
        onSelectStep={onSelectStep}
        contextUsedTokens={detailState.contextUsedTokens}
        contextAllocatedTokens={detailState.contextAllocatedTokens}
        selectedStepId={detailState.selectedStepId}
        sessionId={state.activeSessionId}
        setError={setDesktopError}
        steps={steps}
        thinkingByStep={thinkingByStep}
        thinkingStepId={thinkingStepId}
        timeline={detailState.timeline}
      />
      <ActiveConfirmation clear={() => setConfirmation(undefined)} request={confirmation} />
      <DropOverlay intent={skillsOpen ? undefined : dropIntent} />
    </div>
  );
}
