import type { ModelRuntimeStatus } from "@gardendesk/shared";
import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };
import { TechnicalModelUsage } from "./technical-model-usage.js";

interface OverviewProps {
  catalogPath: string;
  contextAllocatedTokens?: number | null | undefined;
  contextUsedTokens?: number | null | undefined;
  limits: string | undefined;
  model: ModelRuntimeStatus;
  onOpenCatalogFolder?: (() => void) | undefined;
  onOpenSourceFolder?: (() => void) | undefined;
  sessionId: string | undefined;
}

function overviewRows({
  catalogPath,
  limits,
  model,
  onOpenCatalogFolder,
  onOpenSourceFolder,
  sessionId,
}: OverviewProps): Array<[string, string, (() => void) | undefined]> {
  const { sourceMount, workspaceMount, runtimeMount } = capabilities;
  return [
    ["Local session ID", sessionId ?? "No session selected", undefined],
    ["Catalog path", catalogPath || "Not available", onOpenCatalogFolder],
    [
      "Session folder",
      sessionId === undefined
        ? "No session selected"
        : `${workspaceMount.path} · read/write · ${workspaceMount.maximumBytes / 1024 ** 2} MiB`,
      undefined,
    ],
    ["Source mount", `${sourceMount.path} · ${sourceMount.mode} · live`, onOpenSourceFolder],
    [
      "Temporary storage",
      `${runtimeMount.path} · ${runtimeMount.maximumBytes / 1024 ** 2} MiB · temporary`,
      undefined,
    ],
    ["Guest operating system", `Linux ${capabilities.runtimes.Linux}`, undefined],
    [
      "MicroVM limits",
      sessionId === undefined ? "No session selected" : (limits ?? "Not available"),
      undefined,
    ],
    ["MicroVM network access", "false", undefined],
    ["Model", model.name, undefined],
    ["Model state", model.state, undefined],
  ];
}

export function TechnicalOverviewTable(props: OverviewProps) {
  return (
    <table aria-label="Session technical details" className="technical-overview-table">
      <tbody>
        {overviewRows(props).map(([label, value, onOpen]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>
              {onOpen === undefined ? (
                value
              ) : (
                <button
                  className="technical-path-link"
                  onClick={onOpen}
                  title="Open the folder"
                  type="button"
                >
                  {value}
                </button>
              )}
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
