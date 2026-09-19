import { join } from "node:path";
import type { SkillLocations, SkillSummary } from "@gardendesk/shared";
import {
  createPromptDirectory,
  promptDirectoryExists,
  promptPathIsDirectory,
  promptSkillDirectories,
  readPromptFile,
  removePromptDirectory,
  writePromptFile,
} from "../prompt-files.js";
import {
  type SkillMetadata,
  type SkillOverlay,
  skillDocumentMetadata,
} from "./markdown-definition-library.js";

const CONTENT_LIMIT = 128_000;
const SETTINGS_FILE = "settings.json";
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function skillFile(root: string, name: string): string {
  return join(root, name, "SKILL.md");
}

function readMetadata(path: string): SkillMetadata | undefined {
  try {
    return skillDocumentMetadata(readPromptFile(path), path);
  } catch {
    return undefined;
  }
}

function skillDirectories(root: string): string[] {
  if (!promptDirectoryExists(root)) return [];
  return promptSkillDirectories(root)
    .filter((entry) => SKILL_NAME.test(entry.name))
    .map((entry) => entry.name);
}

/** Skills the person added or changed, kept beside the read-only packaged prompts. */
export class SkillStore implements SkillOverlay {
  private readonly builtInRoot: string;
  private readonly systemRoot: string;

  constructor(
    promptRoot: string,
    private readonly root: string,
  ) {
    this.builtInRoot = join(promptRoot, "skills");
    this.systemRoot = join(promptRoot, "system");
  }

  list(): SkillSummary[] {
    const disabled = this.disabledNames();
    const installed = skillDirectories(this.root);
    const entries = [
      ...skillDirectories(this.builtInRoot)
        .filter((name) => !installed.includes(name))
        .map((name) => this.summary(this.builtInRoot, name, "built-in", disabled)),
      ...installed.map((name) =>
        this.summary(
          this.root,
          name,
          promptDirectoryExists(skillFile(this.builtInRoot, name)) ? "customized" : "installed",
          disabled,
        ),
      ),
    ];
    return entries.sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  }

  installedSkills(): Array<SkillMetadata & { path: string }> {
    const disabled = this.disabledNames();
    return skillDirectories(this.root)
      .filter((name) => !disabled.has(name))
      .flatMap((name) => {
        const path = skillFile(this.root, name);
        const metadata = readMetadata(path);
        return metadata?.name === name ? [{ ...metadata, path }] : [];
      });
  }

  installedSkill(name: string): (SkillMetadata & { path: string }) | undefined {
    if (!SKILL_NAME.test(name)) return undefined;
    const path = skillFile(this.root, name);
    const metadata = readMetadata(path);
    return metadata?.name === name ? { ...metadata, path } : undefined;
  }

  isDisabled(name: string): boolean {
    return this.disabledNames().has(name);
  }

  install(paths: readonly string[]): SkillSummary[] {
    for (const path of paths) this.installOne(path);
    return this.list();
  }

  read(name: string): string {
    return readPromptFile(this.existingPath(name));
  }

  write(name: string, content: string): boolean {
    this.existingPath(name);
    const metadata = this.validated(content);
    if (metadata.name !== name) throw new Error("invalid_skill_name");
    this.save(name, content);
    return true;
  }

  remove(name: string): boolean {
    const directory = join(this.root, this.validName(name));
    if (!promptDirectoryExists(directory)) return false;
    removePromptDirectory(directory);
    return true;
  }

  setEnabled(name: string, enabled: boolean): boolean {
    const disabled = this.disabledNames();
    if (enabled) disabled.delete(this.validName(name));
    else disabled.add(this.validName(name));
    writePromptFile(
      join(this.root, SETTINGS_FILE),
      `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`,
    );
    return true;
  }

  locations(): SkillLocations {
    createPromptDirectory(this.root);
    return {
      builtInSkillsPath: this.builtInRoot,
      skillsPath: this.root,
      systemPromptsPath: this.systemRoot,
    };
  }

  private installOne(path: string): void {
    const content = this.sourceContent(path);
    const metadata = this.validated(content);
    this.save(metadata.name, content);
  }

  private sourceContent(path: string): string {
    try {
      const file = promptPathIsDirectory(path) ? join(path, "SKILL.md") : path;
      if (!file.toLowerCase().endsWith(".md")) throw new Error("invalid_skill_file");
      return readPromptFile(file);
    } catch {
      throw new Error("invalid_skill_file");
    }
  }

  private validated(content: string): SkillMetadata {
    if (content.length > CONTENT_LIMIT) throw new Error("invalid_skill_file");
    try {
      return skillDocumentMetadata(content, "skill");
    } catch {
      throw new Error("invalid_skill_file");
    }
  }

  private save(name: string, content: string): void {
    writePromptFile(skillFile(this.root, name), content);
  }

  private existingPath(name: string): string {
    const installed = skillFile(this.root, this.validName(name));
    if (promptDirectoryExists(installed)) return installed;
    const builtIn = skillFile(this.builtInRoot, name);
    if (promptDirectoryExists(builtIn)) return builtIn;
    throw new Error("invalid_skill_name");
  }

  private summary(
    root: string,
    name: string,
    source: SkillSummary["source"],
    disabled: ReadonlySet<string>,
  ): SkillSummary {
    const path = skillFile(root, name);
    const metadata = readMetadata(path);
    return {
      description: metadata?.description ?? "",
      enabled: !disabled.has(name),
      name,
      path,
      source,
      valid: metadata?.name === name,
    };
  }

  private validName(name: string): string {
    if (!SKILL_NAME.test(name) || name.length > 64) throw new Error("invalid_skill_name");
    return name;
  }

  private disabledNames(): Set<string> {
    try {
      const parsed: unknown = JSON.parse(readPromptFile(join(this.root, SETTINGS_FILE)));
      const names = (parsed as { disabled?: unknown }).disabled;
      return new Set(Array.isArray(names) ? names.filter((name) => typeof name === "string") : []);
    } catch {
      return new Set();
    }
  }
}
