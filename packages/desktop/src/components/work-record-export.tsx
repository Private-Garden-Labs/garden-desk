import { useState } from "react";
import type { DesktopApi } from "../api.js";
import { t } from "../i18n/index.js";

type ExportState =
  | { kind: "idle" | "exporting" | "failed" }
  | { kind: "saved"; file: string; verified: boolean };

export function WorkRecordExport({
  api,
  nativeActionMessage,
  sessionId,
}: {
  api: DesktopApi;
  nativeActionMessage: string | undefined;
  sessionId: string;
}) {
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  const exportRecord = async () => {
    setState({ kind: "exporting" });
    try {
      const result = await api.exportWorkRecord(sessionId, {
        asked: t("workRecord.asked"),
        did: t("workRecord.did"),
        files: t("workRecord.files"),
        law: t("workRecord.law"),
        audit: t("workRecord.audit"),
        chainVerified: t("workRecord.chainVerified"),
        yes: t("workRecord.yes"),
        no: t("workRecord.no"),
      });
      setState(result === undefined ? { kind: "idle" } : { kind: "saved", ...result });
    } catch {
      setState({ kind: "failed" });
    }
  };
  return (
    <article className="technical-details-item technical-overview">
      <p className="debug-snapshot-purpose">{t("workRecord.title")}</p>
      <p className="technical-limits">{t("workRecord.note")}</p>
      <button
        disabled={state.kind === "exporting" || nativeActionMessage !== undefined}
        onClick={() => void exportRecord()}
        title={nativeActionMessage}
        type="button"
      >
        {state.kind === "exporting" ? t("workRecord.exporting") : t("workRecord.export")}
      </button>
      {state.kind === "saved" ? (
        <p aria-live="polite">
          {t("workRecord.saved", { file: state.file })}{" "}
          {state.verified ? t("workRecord.verified") : t("workRecord.unverified")}
        </p>
      ) : null}
      {state.kind === "failed" ? <p role="alert">{t("workRecord.failed")}</p> : null}
    </article>
  );
}
