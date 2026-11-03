import type { SkillLocations, SkillSummary } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi, PromptFolder } from "./api.js";
import { t } from "./i18n/index.js";

type SetError = (message: string | undefined) => void;

export async function showPromptFolder(api: DesktopApi, folder: PromptFolder, setError: SetError) {
  setError(undefined);
  try {
    await api.openPromptFolder(folder);
  } catch {
    setError(t("error.folderOpen"));
  }
}

export function usePromptLocations(api: DesktopApi): SkillLocations | undefined {
  const [locations, setLocations] = useState<SkillLocations>();
  useEffect(() => {
    let active = true;
    api
      .skillLocations()
      .then((value) => {
        if (active) setLocations(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api]);
  return locations;
}

export interface SkillDraft {
  content: string;
  name: string;
  path: string;
  source: SkillSummary["source"];
}

export interface SkillsController {
  addFiles(): void;
  addPaths(paths: string[]): Promise<void>;
  cancelEdit(): void;
  draft: SkillDraft | undefined;
  edit(skill: SkillSummary): void;
  error: string | undefined;
  openFolder(): void;
  remove(name: string): void;
  save(content: string): void;
  setEnabled(name: string, enabled: boolean): void;
  skills: SkillSummary[] | undefined;
  working: boolean;
}

function useSkillRequests(api: DesktopApi, setError: SetError) {
  const [skills, setSkills] = useState<SkillSummary[]>();
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setSkills(await api.listSkills());
    } catch {
      setError(t("error.skillsLoad"));
    }
  }, [api, setError]);
  const run = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      setWorking(true);
      setError(undefined);
      try {
        await action();
      } catch {
        setError(failure);
      }
      await refresh();
      setWorking(false);
    },
    [refresh, setError],
  );
  return { refresh, run, skills, working };
}

export function useSkills(api: DesktopApi, open: boolean): SkillsController {
  const [error, setError] = useState<string>();
  const { refresh, run, skills, working } = useSkillRequests(api, setError);
  const [draft, setDraft] = useState<SkillDraft>();
  useEffect(() => {
    if (!open) return;
    setDraft(undefined);
    setError(undefined);
    void refresh();
  }, [open, refresh]);
  return {
    draft,
    error,
    skills,
    working,
    addFiles: () => void run(() => api.chooseSkillFiles(), t("error.skillSave")),
    addPaths: async (paths) => {
      await run(() => api.addSkillFiles(paths), t("error.skillSave"));
    },
    cancelEdit: () => setDraft(undefined),
    edit: (skill) => {
      setError(undefined);
      api
        .readSkill(skill.name)
        .then((content) =>
          setDraft({ content, name: skill.name, path: skill.path, source: skill.source }),
        )
        .catch(() => setError(t("error.skillOpen")));
    },
    openFolder: () => {
      void showPromptFolder(api, "skills", setError);
    },
    remove: (name) => void run(() => api.removeSkill(name), t("error.skillRemove")),
    save: (content) => {
      const name = draft?.name;
      if (name === undefined) return;
      setDraft(undefined);
      void run(() => api.writeSkill(name, content), t("error.skillSave"));
    },
    setEnabled: (name, enabled) =>
      void run(() => api.setSkillEnabled(name, enabled), t("error.skillChange")),
  };
}
