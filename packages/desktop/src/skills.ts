import type { SkillLocations, SkillSummary } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi, PromptFolder } from "./api.js";

type SetError = (message: string | undefined) => void;

const FOLDER_FAILURE = "The folder could not be opened.";

export async function showPromptFolder(api: DesktopApi, folder: PromptFolder, setError: SetError) {
  setError(undefined);
  try {
    await api.openPromptFolder(folder);
  } catch {
    setError(FOLDER_FAILURE);
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

const LOAD_FAILURE = "The skills could not be read.";
const SAVE_FAILURE =
  "The skill was not saved. Each skill file starts with a name and a description.";

function useSkillRequests(api: DesktopApi, setError: SetError) {
  const [skills, setSkills] = useState<SkillSummary[]>();
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setSkills(await api.listSkills());
    } catch {
      setError(LOAD_FAILURE);
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
    addFiles: () => void run(() => api.chooseSkillFiles(), SAVE_FAILURE),
    addPaths: async (paths) => {
      await run(() => api.addSkillFiles(paths), SAVE_FAILURE);
    },
    cancelEdit: () => setDraft(undefined),
    edit: (skill) => {
      setError(undefined);
      api
        .readSkill(skill.name)
        .then((content) =>
          setDraft({ content, name: skill.name, path: skill.path, source: skill.source }),
        )
        .catch(() => setError("The skill file could not be opened."));
    },
    openFolder: () => {
      void showPromptFolder(api, "skills", setError);
    },
    remove: (name) => void run(() => api.removeSkill(name), "The skill could not be removed."),
    save: (content) => {
      const name = draft?.name;
      if (name === undefined) return;
      setDraft(undefined);
      void run(() => api.writeSkill(name, content), SAVE_FAILURE);
    },
    setEnabled: (name, enabled) =>
      void run(() => api.setSkillEnabled(name, enabled), "The skill could not be changed."),
  };
}
