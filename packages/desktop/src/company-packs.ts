import type { CompanyPackImport, CompanyPacks } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";

const POLL_MS = 1_000;

export interface TrustRequest {
  path: string;
  publisher: string;
  fingerprint: string;
}

export interface CompanyPacksController {
  build(name: string, publisher: string): void;
  cancelTrust(): void;
  chooseFolder(): void;
  importing: boolean;
  importPack(path?: string): void;
  message: string | undefined;
  status: CompanyPacks | undefined;
  trust(): void;
  trustRequest: TrustRequest | undefined;
}

function packId(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug === "" ? "pack" : slug;
}

const FINISHED = new Set(["installed", "untrusted", "invalid", "failed"]);

function importMessage(result: CompanyPackImport): string {
  if (result.status === "installed" || result.status === "invalid")
    return t(`companyPacks.${result.status}`);
  return t("companyPacks.error");
}

function useImportResult(
  result: CompanyPackImport | undefined,
  setMessage: (message: string) => void,
  refreshLaws: () => Promise<void>,
) {
  const [awaiting, setAwaiting] = useState(false);
  const [trustRequest, setTrustRequest] = useState<TrustRequest>();
  useEffect(() => {
    if (!awaiting || result === undefined || !FINISHED.has(result.status)) return;
    setAwaiting(false);
    if (result.status === "untrusted") setTrustRequest(result);
    else setMessage(importMessage(result));
    void refreshLaws();
  }, [awaiting, result, setMessage, refreshLaws]);
  return { awaiting, setAwaiting, trustRequest, setTrustRequest };
}

export function useCompanyPacks(
  api: DesktopApi,
  open: boolean,
  refreshLaws: () => Promise<void>,
): CompanyPacksController {
  const [status, setStatus] = useState<CompanyPacks>();
  const [message, setMessage] = useState<string>();
  const imports = useImportResult(status?.import, setMessage, refreshLaws);
  const refresh = useCallback(async () => {
    if (open) setStatus(await api.companyPacks().catch(() => undefined));
  }, [api, open]);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    if (status?.build.state !== "building" && status?.import.status !== "importing") return;
    const timer = setTimeout(() => void refresh(), POLL_MS);
    return () => clearTimeout(timer);
  }, [status, refresh]);
  const run = async (action: () => Promise<unknown>) => {
    setMessage(undefined);
    try {
      await action();
    } catch {
      setMessage(t("companyPacks.error"));
    }
    await refresh();
  };
  const importPack = async (path: string, trust?: string) => {
    if (await api.importCompanyPack(path, trust)) imports.setAwaiting(true);
  };
  return {
    importing: imports.awaiting || status?.import.status === "importing",
    message,
    status,
    trustRequest: imports.trustRequest,
    build: (name, publisher) => void run(() => api.buildCompanyPack(name, packId(name), publisher)),
    cancelTrust: () => imports.setTrustRequest(undefined),
    chooseFolder: () => void run(() => api.chooseCompanyPackFolder()),
    importPack: (path) =>
      void run(async () => {
        const chosen = path ?? (await api.chooseCompanyPack());
        if (chosen !== undefined) await importPack(chosen);
      }),
    trust: () => {
      const request = imports.trustRequest;
      imports.setTrustRequest(undefined);
      if (request !== undefined) void run(() => importPack(request.path, request.fingerprint));
    },
  };
}
