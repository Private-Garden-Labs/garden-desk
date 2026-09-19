import { basename, join } from "node:path";
import {
  promptMarkdownFiles,
  promptSkillDirectories,
  readPromptFile,
  readPromptPrefix,
} from "../prompt-files.js";

const BODY_LIMIT = 128_000;
const FRONTMATTER_LIMIT = 16_384;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TOOL_NAME = /^[a-z][a-z0-9-]*$/u;

export interface AgentMetadata {
  description: string;
  mode: "primary" | "subagent";
  name: string;
  skills: readonly string[];
  steps: number;
  temperature: number;
  tools: readonly string[];
}

export interface AgentDefinition extends AgentMetadata {
  body: string;
}

export interface SkillMetadata {
  description: string;
  name: string;
}

export interface SkillDefinition extends SkillMetadata {
  body: string;
}

export interface SkillOverlay {
  installedSkill(name: string): (SkillMetadata & { path: string }) | undefined;
  installedSkills(): ReadonlyArray<SkillMetadata & { path: string }>;
  isDisabled(name: string): boolean;
}

interface FrontmatterDocument {
  bodyStart: string;
  values: ReadonlyMap<string, string>;
}

function parseFrontmatter(content: string, path: string): FrontmatterDocument {
  if (!content.startsWith("---\n")) throw new Error(`Invalid Markdown frontmatter: ${path}`);
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) throw new Error(`Invalid Markdown frontmatter: ${path}`);
  const values = new Map<string, string>();
  for (const line of content.slice(4, end).split("\n")) {
    const match = /^([a-z][a-z-]*):\s*(.+)$/u.exec(line);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined || values.has(key)) {
      throw new Error(`Invalid Markdown frontmatter: ${path}`);
    }
    values.set(key, value);
  }
  return { bodyStart: content.slice(end + 5), values };
}

function readFrontmatter(path: string): FrontmatterDocument {
  return parseFrontmatter(readPromptPrefix(path, FRONTMATTER_LIMIT), path);
}

function required(values: ReadonlyMap<string, string>, key: string, path: string): string {
  const value = values.get(key)?.trim();
  if (value === undefined || value.length === 0 || value.length > 1_024) {
    throw new Error(`Invalid ${key} in ${path}`);
  }
  return value;
}

function only(values: ReadonlyMap<string, string>, keys: readonly string[], path: string): void {
  if ([...values.keys()].some((key) => !keys.includes(key))) {
    throw new Error(`Unsupported Markdown metadata in ${path}`);
  }
}

function parseList(value: string, key: string, path: string, pattern: RegExp): string[] {
  const match = /^\[([^\]]+)\]$/u.exec(value.trim());
  const items = match?.[1]?.split(",").map((item) => item.trim()) ?? [];
  if (items.length === 0 || items.some((item) => !pattern.test(item))) {
    throw new Error(`Invalid ${key} in ${path}`);
  }
  return items;
}

function numberValue(
  values: ReadonlyMap<string, string>,
  key: string,
  path: string,
  valid: (value: number) => boolean,
): number {
  const value = Number(required(values, key, path));
  if (!Number.isFinite(value) || !valid(value)) throw new Error(`Invalid ${key} in ${path}`);
  return value;
}

function validateName(name: string, expectedName: string, path: string): string {
  if (!IDENTIFIER.test(name) || name !== expectedName || name.length > 64) {
    throw new Error(`Invalid name in ${path}`);
  }
  return name;
}

function agentMetadata(path: string, expectedName: string): AgentMetadata {
  const { bodyStart, values } = readFrontmatter(path);
  only(values, ["name", "description", "mode", "tools", "skills", "temperature", "steps"], path);
  if (bodyStart.trim().length === 0) throw new Error(`Missing Markdown body: ${path}`);
  const mode = required(values, "mode", path);
  if (mode !== "primary" && mode !== "subagent") throw new Error(`Invalid mode in ${path}`);
  const skills = values.get("skills");
  return {
    description: required(values, "description", path),
    mode,
    name: validateName(required(values, "name", path), expectedName, path),
    skills: skills === undefined ? [] : parseList(skills, "skills", path, IDENTIFIER),
    steps: numberValue(
      values,
      "steps",
      path,
      (value) => Number.isInteger(value) && value > 0 && value <= 40,
    ),
    temperature: numberValue(values, "temperature", path, (value) => value >= 0 && value <= 2),
    tools: parseList(required(values, "tools", path), "tools", path, TOOL_NAME),
  };
}

function skillMetadata(path: string, expectedName: string): SkillMetadata {
  const metadata = skillDocumentMetadata(readPromptPrefix(path, FRONTMATTER_LIMIT), path);
  return { ...metadata, name: validateName(metadata.name, expectedName, path) };
}

export function skillDocumentMetadata(content: string, path: string): SkillMetadata {
  const { bodyStart, values } = parseFrontmatter(content, path);
  only(values, ["name", "description"], path);
  if (bodyStart.trim().length === 0) throw new Error(`Missing Markdown body: ${path}`);
  const name = required(values, "name", path);
  if (!IDENTIFIER.test(name) || name.length > 64) throw new Error(`Invalid name in ${path}`);
  return { description: required(values, "description", path), name };
}

function body(path: string): string {
  const content = readPromptFile(path).trim();
  if (content.length > BODY_LIMIT) throw new Error(`Markdown definition is too long: ${path}`);
  return parseFrontmatter(content, path).bodyStart.trim();
}

function markdownFiles(directory: string): Array<{ name: string; path: string }> {
  return promptMarkdownFiles(directory)
    .map((entry) => ({ name: basename(entry.name, ".md"), path: entry.path }))
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
}

function skillFiles(directory: string): Array<{ name: string; path: string }> {
  return promptSkillDirectories(directory)
    .map((entry) => ({ name: entry.name, path: join(entry.path, "SKILL.md") }))
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
}

export class MarkdownDefinitionLibrary {
  readonly agents: readonly AgentMetadata[];
  private readonly packagedSkills: readonly SkillMetadata[];
  private readonly agentPaths: ReadonlyMap<string, string>;
  private readonly skillPaths: ReadonlyMap<string, string>;

  constructor(
    private readonly root: string,
    private readonly overlay?: SkillOverlay,
  ) {
    const agentFiles = markdownFiles(join(root, "agents"));
    const skillEntries = skillFiles(join(root, "skills"));
    this.agentPaths = new Map(agentFiles.map((entry) => [entry.name, entry.path]));
    this.skillPaths = new Map(skillEntries.map((entry) => [entry.name, entry.path]));
    this.agents = agentFiles.map((entry) => agentMetadata(entry.path, entry.name));
    this.packagedSkills = skillEntries.map((entry) => skillMetadata(entry.path, entry.name));
    for (const agent of this.agents) {
      const unknown = agent.skills.find((name) => !this.skillPaths.has(name));
      if (unknown !== undefined) throw new Error(`Unknown skill ${unknown} in agent ${agent.name}`);
    }
  }

  get skills(): readonly SkillMetadata[] {
    const installed = this.overlay?.installedSkills() ?? [];
    const installedNames = new Set(installed.map((skill) => skill.name));
    return [
      ...this.packagedSkills.filter(
        (skill) => !installedNames.has(skill.name) && this.overlay?.isDisabled(skill.name) !== true,
      ),
      ...installed.map((skill) => ({ description: skill.description, name: skill.name })),
    ].sort((left, right) => left.name.localeCompare(right.name, "en-US"));
  }

  /** Names the person added that no packaged skill uses, so every skill-loading agent can reach them. */
  addedSkillNames(): ReadonlySet<string> {
    const packaged = new Set(this.packagedSkills.map((skill) => skill.name));
    return new Set(
      (this.overlay?.installedSkills() ?? [])
        .map((skill) => skill.name)
        .filter((name) => !packaged.has(name)),
    );
  }

  agent(name: string): AgentDefinition {
    const metadata = this.agents.find((agent) => agent.name === name);
    const path = this.agentPaths.get(name);
    if (metadata === undefined || path === undefined) throw new Error(`Unknown agent: ${name}`);
    return { ...metadata, body: body(path) };
  }

  skill(name: string): SkillDefinition {
    const installed = this.overlay?.installedSkill(name);
    const metadata = installed ?? this.packagedSkills.find((skill) => skill.name === name);
    const path = installed?.path ?? this.skillPaths.get(name);
    if (metadata === undefined || path === undefined) throw new Error(`Unknown skill: ${name}`);
    return { description: metadata.description, name: metadata.name, body: body(path) };
  }

  system(name: string): string {
    if (!IDENTIFIER.test(name)) throw new Error(`Unknown system prompt: ${name}`);
    const path = join(this.root, "system", `${name}.md`);
    const content = readPromptFile(path).trim();
    if (content.length === 0 || content.length > BODY_LIMIT) {
      throw new Error(`Invalid system prompt: ${name}`);
    }
    return content;
  }
}
