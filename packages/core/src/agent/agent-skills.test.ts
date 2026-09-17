import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentInstructions, agentSkillReader } from "./agent-skills.js";
import { MarkdownDefinitionLibrary } from "./markdown-definition-library.js";

async function prompts(agents: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-skills-"));
  await mkdir(join(root, "skills", "alpha"), { recursive: true });
  await mkdir(join(root, "skills", "beta"), { recursive: true });
  await mkdir(join(root, "agents"), { recursive: true });
  await writeFile(
    join(root, "skills", "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha.\n---\nAlpha rules.",
  );
  await writeFile(
    join(root, "skills", "beta", "SKILL.md"),
    "---\nname: beta\ndescription: Beta.\n---\nBeta rules.",
  );
  for (const [name, tools] of Object.entries(agents)) {
    await writeFile(
      join(root, "agents", `${name}.md`),
      `---\nname: ${name}\ndescription: Test.\nmode: subagent\ntools: [${tools}]\nskills: [alpha]\ntemperature: 0\nsteps: 1\n---\nBody.`,
    );
  }
  return root;
}

describe("agent skills", () => {
  it("includes listed skills without the skill tool, filters them with it, and rejects unknown names", async () => {
    const library = new MarkdownDefinitionLibrary(
      await prompts({ fixed: "read", loader: "read, skill" }),
    );
    const fixed = library.agent("fixed");
    const loader = library.agent("loader");

    expect(agentInstructions(library, fixed)).toBe("Body.\n\n## Skill: alpha\n\nAlpha rules.");
    expect(agentSkillReader(library, fixed).metadata()).toEqual([]);
    expect(agentInstructions(library, loader)).toBe("Body.");
    expect(
      agentSkillReader(library, loader)
        .metadata()
        .map((skill) => skill.name),
    ).toEqual(["alpha"]);

    const root = await prompts({});
    await writeFile(
      join(root, "agents", "broken.md"),
      "---\nname: broken\ndescription: Test.\nmode: subagent\ntools: [read]\nskills: [gamma]\ntemperature: 0\nsteps: 1\n---\nBody.",
    );
    expect(() => new MarkdownDefinitionLibrary(root)).toThrow(
      "Unknown skill gamma in agent broken",
    );
  });
});
