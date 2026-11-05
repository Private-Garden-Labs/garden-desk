import type { LawJurisdictionSummary } from "@gardendesk/shared";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DesktopApi } from "./api.js";
import {
  type CitationIndex,
  citationIndex,
  EMPTY_CITATION_INDEX,
  type LawTarget,
} from "./law-citations.js";

let lawTarget: LawTarget | undefined;
let citations: CitationIndex = EMPTY_CITATION_INDEX;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openLaw(target: LawTarget): void {
  lawTarget = target;
  changed();
}

export function openCitation(citation: string): void {
  const target = citations.targets.get(citation);
  if (target !== undefined) openLaw(target);
}

export function closeLaw(): void {
  lawTarget = undefined;
  changed();
}

const citationSnapshot = () => citations;
const targetSnapshot = () => lawTarget;

export function useCitationIndex(): CitationIndex {
  return useSyncExternalStore(subscribe, citationSnapshot, citationSnapshot);
}

export function useSidePanel(api: DesktopApi, laws: LawJurisdictionSummary[] | undefined) {
  const target = useSyncExternalStore(subscribe, targetSnapshot, targetSnapshot);
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
  const installed = laws?.map((law) => `${law.id}:${law.currentAsOf}`).join() ?? "";
  useEffect(() => {
    if (installed === "") return;
    let current = true;
    api
      .listLawCitations()
      .then((groups) => {
        if (!current) return;
        citations = citationIndex(groups);
        changed();
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [api, installed]);
  return {
    lawTarget: target,
    technicalDetailsOpen: technicalDetailsOpen && target === undefined,
    setTechnicalDetailsOpen(open: boolean) {
      if (open) closeLaw();
      setTechnicalDetailsOpen(open);
    },
  };
}
