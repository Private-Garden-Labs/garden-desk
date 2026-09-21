import type { ModelRuntimeStatus, SkillLocations } from "@gardendesk/shared";
import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };
import type { PromptFolder } from "../api.js";
import { TechnicalModelUsage } from "./technical-model-usage.js";

interface OverviewRow {
  label: string;
  value: string;
  onOpen?: (() => void) | undefined;
  path?: boolean;
}

interface OverviewProps {
  catalogPath: string;
  contextAllocatedTokens?: number | null | undefined;
  contextUsedTokens?: number | null | undefined;
  limits: string | undefined;
  model: ModelRuntimeStatus;
  onOpenCatalogFolder?: (() => void) | undefined;
  onOpenPromptFolder?: ((folder: PromptFolder) => void) | undefined;
  onOpenSourceFolder?: (() => void) | undefined;
  promptLocations?: SkillLocations | undefined;
  sessionId: string | undefined;
}

const NO_SESSION = "No session selected";
const NOT_AVAILABLE = "Not available";

function mebibytes(bytes: number): string {
  return `${bytes / 1024 ** 2} MiB`;
}

function promptRows({ onOpenPromptFolder: onOpen, promptLocations }: OverviewProps): OverviewRow[] {
  const entries: Array<[string, PromptFolder, string | undefined]> = [
    ["Skills folder", "skills", promptLocations?.skillsPath],
    ["Built-in skills", "built-in-skills", promptLocations?.builtInSkillsPath],
    ["System prompts", "system-prompts", promptLocations?.systemPromptsPath],
  ];
  return entries.map(([label, folder, path]) => ({
    label,
    value: path ?? NOT_AVAILABLE,
    onOpen: path === undefined || onOpen === undefined ? undefined : () => onOpen(folder),
    path: path !== undefined,
  }));
}

function guestRows({ limits, onOpenSourceFolder, sessionId }: OverviewProps): OverviewRow[] {
  const { sourceMount, workspaceMount, runtimeMount } = capabilities;
  return [
    {
      label: "Session folder",
      value:
        sessionId === undefined
          ? NO_SESSION
          : `${workspaceMount.path} · read/write · ${mebibytes(workspaceMount.maximumBytes)}`,
    },
    {
      label: "Source mount",
      value: `${sourceMount.path} · ${sourceMount.mode} · live`,
      onOpen: onOpenSourceFolder,
    },
    {
      label: "Temporary storage",
      value: `${runtimeMount.path} · ${mebibytes(runtimeMount.maximumBytes)} · temporary`,
    },
    { label: "Guest operating system", value: `Linux ${capabilities.runtimes.Linux}` },
    {
      label: "MicroVM limits",
      value: sessionId === undefined ? NO_SESSION : (limits ?? NOT_AVAILABLE),
    },
    { label: "MicroVM network access", value: "false" },
  ];
}

function overviewRows(props: OverviewProps): OverviewRow[] {
  return [
    { label: "Local session ID", value: props.sessionId ?? NO_SESSION },
    {
      label: "Catalog path",
      value: props.catalogPath || NOT_AVAILABLE,
      onOpen: props.onOpenCatalogFolder,
      path: props.catalogPath !== "",
    },
    ...promptRows(props),
    ...guestRows(props),
    { label: "Model", value: props.model.name },
    { label: "Model state", value: props.model.state },
  ];
}

function separatorIndex(value: string): number {
  return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

function splitPath(value: string): [string, string] | undefined {
  const last = separatorIndex(value);
  if (last <= 0) return undefined;
  const previous = separatorIndex(value.slice(0, last));
  const cut = previous > 0 ? previous : last;
  return [value.slice(0, cut), value.slice(cut)];
}

function OverviewValue({ row }: { row: OverviewRow }) {
  const parts = row.path === true ? splitPath(row.value) : undefined;
  const content =
    parts === undefined ? (
      row.value
    ) : (
      <>
        <span className="technical-path-parent">{parts[0]}</span>
        <span className="technical-path-name">{parts[1]}</span>
      </>
    );
  const title = parts === undefined ? "Open the folder" : row.value;
  if (row.onOpen === undefined) {
    if (parts === undefined) return <>{row.value}</>;
    return (
      <span className="technical-path" title={title}>
        {content}
      </span>
    );
  }
  return (
    <button
      className={parts === undefined ? "technical-path-link" : "technical-path-link technical-path"}
      onClick={row.onOpen}
      title={title}
      type="button"
    >
      {content}
    </button>
  );
}

export function TechnicalOverviewTable(props: OverviewProps) {
  return (
    <table aria-label="Session technical details" className="technical-overview-table">
      <tbody>
        {overviewRows(props).map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>
              <OverviewValue row={row} />
            </td>
          </tr>
        ))}
        <TechnicalModelUsage
          contextAllocatedTokens={props.contextAllocatedTokens}
          contextUsedTokens={props.contextUsedTokens}
          model={props.model}
        />
      </tbody>
    </table>
  );
}
