import type {
  AgentArtifactSummary,
  AgentExecutionSnapshot,
  ModelRuntimeStatus,
} from "@gardendesk/shared";
import { type CSSProperties, useEffect, useReducer, useState } from "react";
import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };
import type { DesktopApi, PromptFolder } from "../api.js";
import {
  type DebugSnapshotState,
  debugSnapshotReducer,
  initialDebugSnapshotState,
} from "../debug-snapshot.js";
import { showCatalogFolder, showFolder } from "../desktop-actions.js";
import { desktopPlatform } from "../platform.js";
import { showPromptFolder, usePromptLocations } from "../skills.js";
import type { TimelineItem } from "../state.js";
import type { AgentStep } from "../steps.js";
import { DrawerResizeHandle, useDrawerResize } from "./drawer-resize.js";
import { Icon } from "./icons.js";
import { StepList } from "./step-list.js";
import { selectAdjacentTab } from "./tab-keyboard.js";
import { sessionTitle } from "./technical-details-title.js";
import { splitPath, TechnicalOverviewTable } from "./technical-overview-table.js";
import { TranscriptCopy } from "./transcript-copy.js";

export { shouldFollowLog } from "./technical-logs.js";

function guestCapabilities(): string {
  const runtimes = Object.entries(capabilities.runtimes).map(
    ([name, version]) => `${name}: ${version}`,
  );
  return [
    `Source: ${capabilities.sourceMount.path} (${capabilities.sourceMount.mode}, live)`,
    `Workspace: ${capabilities.workspaceMount.path} (${capabilities.workspaceMount.maximumBytes} bytes)`,
    `Temporary runtime: ${capabilities.runtimeMount.path} (${capabilities.runtimeMount.maximumBytes} bytes, ephemeral)`,
    `Shell: ${capabilities.shell}`,
    "Runtimes:",
    ...runtimes,
    "Executables:",
    ...capabilities.executables,
  ].join("\n");
}

interface TechnicalDetailsProps {
  api: DesktopApi;
  artifacts: AgentArtifactSummary[];
  catalogPath: string;
  executions: AgentExecutionSnapshot[];
  folderId: string | null | undefined;
  model: ModelRuntimeStatus;
  open: boolean;
  sessionId: string | undefined;
  timeline: TimelineItem[];
  steps: AgentStep[];
  selectedStepId: string | undefined;
  thinkingByStep: Readonly<Record<string, string>>;
  thinkingStepId: string | undefined;
  nativeActionMessage?: string | undefined;
  contextUsedTokens?: number | null;
  contextAllocatedTokens?: number | null;
  onClose(): void;
  onSelectStep(stepId: string | undefined): void;
  setError(message: string | undefined): void;
}

function SnapshotPath({ path }: { path: string }) {
  const parts = splitPath(path);
  return (
    <span className="debug-snapshot-path" title={path}>
      {parts === undefined ? (
        path
      ) : (
        <>
          <span className="technical-path-parent">{parts[0]}</span>
          <span className="technical-path-name">{parts[1]}</span>
        </>
      )}
    </span>
  );
}

function errorCode(error: unknown): string {
  return typeof error === "string" ? error : "unknown";
}

export function DebugSnapshotPanel({
  onCreate,
  onReveal,
  state,
}: {
  onCreate(): void;
  onReveal(): void;
  state: DebugSnapshotState;
}) {
  return (
    <div className="debug-snapshot-controls">
      <button disabled={state.creating || state.revealing} onClick={onCreate} type="button">
        {state.creating ? "Saving snapshot…" : "Save debug snapshot"}
      </button>
      {state.path === undefined ? null : (
        <div className="debug-snapshot-result">
          <p>
            Saved. <SnapshotPath path={state.path} />
          </p>
          <button disabled={state.revealing} onClick={onReveal} type="button">
            {desktopPlatform(navigator.userAgent) === "windows"
              ? "Show in Explorer"
              : "Show in Finder"}
          </button>
        </div>
      )}
      {state.error === undefined ? null : <p role="alert">{state.error}</p>}
    </div>
  );
}

function DebugSnapshotControls({
  api,
  nativeActionMessage,
  sessionId,
}: {
  api: DesktopApi;
  nativeActionMessage?: string | undefined;
  sessionId: string;
}) {
  const [state, dispatch] = useReducer(debugSnapshotReducer, initialDebugSnapshotState);
  const create = async () => {
    dispatch({ type: "create.start" });
    try {
      dispatch({ type: "create.succeeded", path: await api.createDebugSnapshot(sessionId) });
    } catch (error) {
      dispatch({ type: "create.failed", code: errorCode(error) });
    }
  };
  const reveal = async () => {
    dispatch({ type: "reveal.start" });
    try {
      await api.revealDebugSnapshot(sessionId);
      dispatch({ type: "reveal.succeeded" });
    } catch (error) {
      dispatch({ type: "reveal.failed", code: errorCode(error) });
    }
  };
  if (nativeActionMessage !== undefined) {
    return (
      <div className="debug-snapshot-controls">
        <button disabled title={nativeActionMessage} type="button">
          Save debug snapshot
        </button>
        <p>{nativeActionMessage}</p>
      </div>
    );
  }
  return (
    <DebugSnapshotPanel
      onCreate={() => void create()}
      onReveal={() => void reveal()}
      state={state}
    />
  );
}

function Overview({
  api,
  catalogPath,
  executions,
  folderId,
  model,
  nativeActionMessage,
  sessionId,
  setError,
  timeline,
  contextUsedTokens,
  contextAllocatedTokens,
  artifacts,
}: TechnicalDetailsProps) {
  const limits = timeline.find((item) => item.eventType === "run.started")?.text;
  const nativeActions = nativeActionMessage === undefined;
  const promptLocations = usePromptLocations(api);
  return (
    <div className="technical-details-scroll" role="tabpanel" id="technical-overview-panel">
      <article className="technical-details-item technical-overview">
        <TechnicalOverviewTable
          catalogPath={catalogPath}
          contextAllocatedTokens={contextAllocatedTokens}
          contextUsedTokens={contextUsedTokens}
          limits={limits}
          model={model}
          onOpenCatalogFolder={
            nativeActions && catalogPath !== ""
              ? () => void showCatalogFolder(api, setError)
              : undefined
          }
          onOpenPromptFolder={
            nativeActions
              ? (folder: PromptFolder) => void showPromptFolder(api, folder, setError)
              : undefined
          }
          onOpenSourceFolder={
            nativeActions && typeof folderId === "string"
              ? () => void showFolder(api, folderId, setError)
              : undefined
          }
          promptLocations={promptLocations}
          sessionId={sessionId}
        />
        <p className="technical-limits">
          Your skills folder is yours to change. The built-in files belong to the installed app.
        </p>
        <details>
          <summary>Show tools and runtimes</summary>
          <pre>{guestCapabilities()}</pre>
        </details>
      </article>
      {sessionId === undefined ? null : (
        <article className="technical-details-item technical-overview">
          <p className="debug-snapshot-purpose">Troubleshooting</p>
          <p className="technical-limits">
            Save a debug snapshot when you want to forward them to Codex / Claude. Both can contain
            private data.
          </p>
          <TranscriptCopy
            artifacts={artifacts}
            executions={executions}
            nativeActionMessage={nativeActionMessage}
            sessionId={sessionId}
            timeline={timeline}
            title={sessionTitle(timeline, sessionId)}
          />
          <DebugSnapshotControls
            api={api}
            key={sessionId}
            nativeActionMessage={nativeActionMessage}
            sessionId={sessionId}
          />
        </article>
      )}
    </div>
  );
}

function Steps({
  onSelectStep,
  selectedStepId,
  steps,
  thinkingByStep,
  thinkingStepId,
}: TechnicalDetailsProps) {
  return (
    <div className="technical-details-scroll" id="technical-steps-panel" role="tabpanel">
      <StepList
        onSelectStep={onSelectStep}
        selectedStepId={selectedStepId}
        steps={steps}
        thinkingByStep={thinkingByStep}
        thinkingStepId={thinkingStepId}
      />
    </div>
  );
}

type DrawerTab = "overview" | "steps";
const DRAWER_TABS = ["overview", "steps"] as const;

function DrawerTabs({ active, onSelect }: { active: DrawerTab; onSelect(tab: DrawerTab): void }) {
  return (
    <div aria-label="Technical details sections" className="drawer-tabs" role="tablist">
      {DRAWER_TABS.map((tab) => (
        <button
          aria-controls={`technical-${tab}-panel`}
          aria-selected={active === tab}
          key={tab}
          onClick={() => onSelect(tab)}
          onKeyDown={(event) => selectAdjacentTab(event, tab, DRAWER_TABS, onSelect)}
          role="tab"
          tabIndex={active === tab ? 0 : -1}
          type="button"
        >
          {tab === "overview" ? "Overview" : "Steps"}
        </button>
      ))}
    </div>
  );
}

export function TechnicalDetails(props: TechnicalDetailsProps) {
  const [tab, setTab] = useState<DrawerTab>(
    props.selectedStepId === undefined ? "overview" : "steps",
  );
  const resize = useDrawerResize();
  useEffect(() => {
    if (props.selectedStepId !== undefined) setTab("steps");
  }, [props.selectedStepId]);
  if (!props.open) return null;
  return (
    <aside
      aria-label="Technical details"
      className="technical-details-drawer"
      style={
        resize.width === undefined
          ? undefined
          : ({ "--technical-details-width": `${resize.width}px` } as CSSProperties)
      }
    >
      <DrawerResizeHandle resize={resize} />
      <header className="technical-details-header">
        <div>
          <h2>Technical details</h2>
          <p>Local limits, diagnostics, and execution evidence</p>
        </div>
        <button aria-label="Close technical details" onClick={props.onClose} type="button">
          <Icon name="close" />
        </button>
      </header>
      <DrawerTabs active={tab} onSelect={setTab} />
      {tab === "overview" ? <Overview {...props} /> : <Steps {...props} />}
    </aside>
  );
}
