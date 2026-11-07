import type { CompanyPacks } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi } from "./api.js";
import { t } from "./i18n/index.js";

const BUILD_POLL_MS = 1_000;

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

export function useCompanyPacks(
  api: DesktopApi,
  open: boolean,
  refreshLaws: () => Promise<void>,
): CompanyPacksController {
  const [status, setStatus] = useState<CompanyPacks>();
  const [message, setMessage] = useState<string>();
  const [trustRequest, setTrustRequest] = useState<TrustRequest>();
  const [importing, setImporting] = useState(false);
  const refresh = useCallback(async () => {
    if (open) setStatus(await api.companyPacks().catch(() => undefined));
  }, [api, open]);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    if (status?.build.state !== "building") return;
    const timer = setTimeout(() => void refresh(), BUILD_POLL_MS);
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
    setImporting(true);
    const result = await api.importCompanyPack(path, trust).finally(() => setImporting(false));
    if (result.status === "untrusted") setTrustRequest({ path, ...result });
    else setMessage(t(`companyPacks.${result.status}`));
    await refreshLaws();
  };
  return {
    importing,
    message,
    status,
    trustRequest,
    build: (name, publisher) => void run(() => api.buildCompanyPack(name, packId(name), publisher)),
    cancelTrust: () => setTrustRequest(undefined),
    chooseFolder: () => void run(() => api.chooseCompanyPackFolder()),
    importPack: (path) =>
      void run(async () => {
        const chosen = path ?? (await api.chooseCompanyPack());
        if (chosen !== undefined) await importPack(chosen);
      }),
    trust: () => {
      setTrustRequest(undefined);
      if (trustRequest !== undefined)
        void run(() => importPack(trustRequest.path, trustRequest.fingerprint));
    },
  };
}
