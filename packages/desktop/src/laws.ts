import type { DataPacks, Jurisdiction, LawJurisdictionSummary } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DataPackKeyStatus, DesktopApi } from "./api.js";
import { type CompanyPacksController, useCompanyPacks } from "./company-packs.js";
import { t } from "./i18n/index.js";

const DOWNLOAD_POLL_MS = 1_000;

export interface LawsController {
  choose(id: Jurisdiction): void;
  company: CompanyPacksController;
  enabled: LawJurisdictionSummary[];
  error: string | undefined;
  install(id: string): void;
  keyStatus: DataPackKeyStatus | undefined;
  laws: LawJurisdictionSummary[] | undefined;
  packs: DataPacks | undefined;
  saveKey(key: string): void;
  selected: Jurisdiction | null;
  setEnabled(id: Jurisdiction, enabled: boolean, source?: string): void;
  working: boolean;
}

export function useLaws(api: DesktopApi, open: boolean): LawsController {
  const [laws, setLaws] = useState<LawJurisdictionSummary[]>();
  const [packs, setPacks] = useState<DataPacks>();
  const [keyStatus, setKeyStatus] = useState<DataPackKeyStatus>();
  const [chosen, setChosen] = useState<Jurisdiction>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setLaws(await api.listLaws());
      if (open) setPacks(await api.listDataPacks());
    } catch {
      setError(t("laws.readError"));
    }
  }, [api, open]);
  useEffect(() => {
    if (open) setError(undefined);
    void refresh();
  }, [open, refresh]);
  useEffect(() => {
    if (!open || packs?.packs.some((pack) => pack.state === "downloading") !== true) return;
    const timer = setTimeout(() => void refresh(), DOWNLOAD_POLL_MS);
    return () => clearTimeout(timer);
  }, [open, packs, refresh]);
  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError(undefined);
    try {
      await action();
    } catch {
      setError(t("laws.changeError"));
    }
    await refresh();
    setWorking(false);
  };
  const enabled = laws?.filter((law) => law.enabled) ?? [];
  return {
    company: useCompanyPacks(api, open, refresh),
    enabled,
    error,
    keyStatus,
    laws,
    packs,
    working,
    choose: setChosen,
    install: (id) => void run(() => api.installDataPack(id)),
    saveKey: (key) => void run(async () => setKeyStatus(await api.saveDataPackKey(key))),
    selected: (enabled.find((law) => law.id === chosen) ?? enabled[0])?.id ?? null,
    setEnabled: (id, value, source) => void run(() => api.setLawEnabled(id, value, source)),
  };
}
