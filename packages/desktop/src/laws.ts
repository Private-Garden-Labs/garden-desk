import type { Jurisdiction, LawJurisdictionSummary } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi } from "./api.js";

export interface LawsController {
  choose(id: Jurisdiction): void;
  enabled: LawJurisdictionSummary[];
  error: string | undefined;
  laws: LawJurisdictionSummary[] | undefined;
  selected: Jurisdiction | null;
  setEnabled(id: Jurisdiction, enabled: boolean): void;
  working: boolean;
}

export function useLaws(api: DesktopApi, open: boolean): LawsController {
  const [laws, setLaws] = useState<LawJurisdictionSummary[]>();
  const [chosen, setChosen] = useState<Jurisdiction>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setLaws(await api.listLaws());
    } catch {
      setError("The law library could not be read.");
    }
  }, [api]);
  useEffect(() => {
    if (open) setError(undefined);
    void refresh();
  }, [open, refresh]);
  const enabled = laws?.filter((law) => law.enabled) ?? [];
  const setEnabled = async (id: Jurisdiction, value: boolean) => {
    setWorking(true);
    setError(undefined);
    try {
      await api.setLawEnabled(id, value);
    } catch {
      setError("The law library could not be changed.");
    }
    await refresh();
    setWorking(false);
  };
  return {
    enabled,
    error,
    laws,
    working,
    choose: setChosen,
    selected: (enabled.find((law) => law.id === chosen) ?? enabled[0])?.id ?? null,
    setEnabled: (id, value) => void setEnabled(id, value),
  };
}
