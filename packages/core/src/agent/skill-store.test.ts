import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarkdownDefinitionLibrary } from "./markdown-definition-library.js";
import { SkillStore } from "./skill-store.js";

function document(name: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${name} description.\n---\n${body}`;
}

async function store(): Promise<{
  downloads: string;
  skills: SkillStore;
  prompts: string;
  root: string;
}> {
  const base = await mkdtemp(join(tmpdir(), "garden-desk-skill-store-"));
  const prompts = join(base, "prompts");
  await mkdir(join(prompts, "agents"), { recursive: true });
  await mkdir(join(prompts, "skills", "alpha"), { recursive: true });
  await writeFile(
    join(prompts, "skills", "alpha", "SKILL.md"),
    document("alpha", "Packaged rules."),
  );
  await writeFile(
    join(prompts, "agents", "primary.md"),
    "---\nname: primary\ndescription: Test.\nmode: primary\ntools: [skill]\nskills: [alpha]\ntemperature: 0\nsteps: 1\n---\nBody.",
  );
  const downloads = join(base, "downloads");
  await mkdir(downloads, { recursive: true });
  const root = join(base, "state", "skills");
  return { downloads, prompts, root, skills: new SkillStore(prompts, root) };
}

describe("skill store", () => {
  it("installs, disables, customizes, and removes skills the agent can load", async () => {
    const { downloads, prompts, root, skills } = await store();
    const library = new MarkdownDefinitionLibrary(prompts, skills);
    const download = join(downloads, "beta.md");
    await writeFile(download, document("beta", "Added rules."));

    skills.install([download]);
    expect(skills.list().map((skill) => [skill.name, skill.source, skill.enabled])).toEqual([
      ["alpha", "built-in", true],
      ["beta", "installed", true],
    ]);
    expect(library.skills.map((skill) => skill.name)).toEqual(["alpha", "beta"]);

    skills.setEnabled("beta", false);
    expect(library.skills.map((skill) => skill.name)).toEqual(["alpha"]);
    expect(skills.list().find((skill) => skill.name === "beta")?.enabled).toBe(false);

    skills.write("alpha", document("alpha", "Edited rules."));
    expect(skills.list().find((skill) => skill.name === "alpha")?.source).toBe("customized");
    expect(library.skill("alpha").body).toBe("Edited rules.");

    expect(skills.remove("alpha")).toBe(true);
    expect(library.skill("alpha").body).toBe("Packaged rules.");
    expect(skills.locations().skillsPath).toBe(root);
    expect(() => skills.install([download.replace("beta.md", "missing.md")])).toThrow(
      "invalid_skill_file",
    );
  });
});
