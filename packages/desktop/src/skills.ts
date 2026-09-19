import type { SkillSummary } from "@gardendesk/shared";
import { useCallback, useEffect, useState } from "react";
import type { DesktopApi } from "./api.js";

type SetError = (message: string | undefined) => void;

export interface SkillDraft {
  content: string;
  name: string;
  source: SkillSummary["source"];
}

export interface SkillsController {
  addFiles(): void;
  addPaths(paths: string[]): Promise<void>;
  cancelEdit(): void;
  draft: SkillDraft | undefined;
  edit(skill: SkillSummary): void;
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

function useSkillRequests(setError: SetError) {
  const [skills, setSkills] = useState<SkillSummary[]>();
  const [working, setWorking] = useState(false);
  const run = useCallback(
    async (action: () => Promise<SkillSummary[] | undefined>, failure: string) => {
      setWorking(true);
      setError(undefined);
      try {
        const next = await action();
        if (next !== undefined) setSkills(next);
      } catch {
        setError(failure);
      } finally {
        setWorking(false);
      }
    },
    [setError],
  );
  return { run, skills, working };
}

export function useSkills(api: DesktopApi, open: boolean, setError: SetError): SkillsController {
  const { run, skills, working } = useSkillRequests(setError);
  const [draft, setDraft] = useState<SkillDraft>();
  useEffect(() => {
    if (!open) return;
    setDraft(undefined);
    void run(() => api.listSkills(), LOAD_FAILURE);
  }, [api, open, run]);
  const change = (action: () => Promise<unknown>, failure: string) =>
    void run(async () => {
      await action();
      return api.listSkills();
    }, failure);
  return {
    draft,
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
        .then((content) => setDraft({ content, name: skill.name, source: skill.source }))
        .catch(() => setError("The skill file could not be opened."));
    },
    openFolder: () => {
      setError(undefined);
      api.openPromptFolder("skills").catch(() => setError("The folder could not be opened."));
    },
    remove: (name) => change(() => api.removeSkill(name), "The skill could not be removed."),
    save: (content) => {
      const name = draft?.name;
      if (name === undefined) return;
      setDraft(undefined);
      change(() => api.writeSkill(name, content), SAVE_FAILURE);
    },
    setEnabled: (name, enabled) =>
      change(() => api.setSkillEnabled(name, enabled), "The skill could not be changed."),
  };
}
