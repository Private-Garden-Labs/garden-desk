import type { ModelRuntimeStatus, SkillLocations } from "@gardendesk/shared";
import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };
import type { PromptFolder } from "../api.js";
import { t } from "../i18n/index.js";
import { TechnicalModelUsage } from "./technical-model-usage.js";

type OverviewRow = [string, string, (() => void) | undefined];

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

function promptRows(
  locations: SkillLocations | undefined,
  onOpen: ((folder: PromptFolder) => void) | undefined,
): OverviewRow[] {
  const entries: Array<[string, PromptFolder, string | undefined]> = [
    [t("overview.skillsFolder"), "skills", locations?.skillsPath],
    [t("overview.builtInSkills"), "built-in-skills", locations?.builtInSkillsPath],
    [t("overview.systemPrompts"), "system-prompts", locations?.systemPromptsPath],
  ];
  return entries.map(([label, folder, path]) => [
    label,
    path ?? t("usage.notAvailable"),
    path === undefined || onOpen === undefined ? undefined : () => onOpen(folder),
  ]);
}

function overviewRows({
  catalogPath,
  limits,
  model,
  onOpenCatalogFolder,
  onOpenPromptFolder,
  onOpenSourceFolder,
  promptLocations,
  sessionId,
}: OverviewProps): OverviewRow[] {
  const { sourceMount, workspaceMount, runtimeMount } = capabilities;
  return [
    [t("overview.sessionId"), sessionId ?? t("overview.noSession"), undefined],
    [t("overview.catalogPath"), catalogPath || t("usage.notAvailable"), onOpenCatalogFolder],
    ...promptRows(promptLocations, onOpenPromptFolder),
    [
      t("overview.sessionFolder"),
      sessionId === undefined
        ? t("overview.noSession")
        : `${workspaceMount.path} · read/write · ${workspaceMount.maximumBytes / 1024 ** 2} MiB`,
      undefined,
    ],
    [
      t("overview.sourceMount"),
      `${sourceMount.path} · ${sourceMount.mode} · live`,
      onOpenSourceFolder,
    ],
    [
      t("overview.tempStorage"),
      `${runtimeMount.path} · ${runtimeMount.maximumBytes / 1024 ** 2} MiB · temporary`,
      undefined,
    ],
    [t("overview.guestOs"), `Linux ${capabilities.runtimes.Linux}`, undefined],
    [
      t("overview.limits"),
      sessionId === undefined ? t("overview.noSession") : (limits ?? t("usage.notAvailable")),
      undefined,
    ],
    [t("overview.network"), "false", undefined],
    [t("overview.model"), model.name, undefined],
    [t("overview.modelState"), model.state, undefined],
  ];
}

function separatorIndex(value: string): number {
  return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

export function splitPath(value: string): [string, string] | undefined {
  const last = separatorIndex(value);
  if (last <= 0) return undefined;
  const previous = separatorIndex(value.slice(0, last));
  const cut = previous > 0 ? previous : last;
  return [value.slice(0, cut), value.slice(cut)];
}

function FolderLink({ onOpen, value }: { onOpen(): void; value: string }) {
  const parts = splitPath(value);
  return (
    <button
      className="technical-path-link"
      onClick={onOpen}
      title={parts === undefined ? t("overview.openFolder") : value}
      type="button"
    >
      {parts === undefined ? (
        value
      ) : (
        <>
          <span className="technical-path-parent">{parts[0]}</span>
          <span className="technical-path-name">{parts[1]}</span>
        </>
      )}
    </button>
  );
}

export function TechnicalOverviewTable(props: OverviewProps) {
  return (
    <table aria-label={t("overview.table")} className="technical-overview-table">
      <tbody>
        {overviewRows(props).map(([label, value, onOpen]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{onOpen === undefined ? value : <FolderLink onOpen={onOpen} value={value} />}</td>
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
