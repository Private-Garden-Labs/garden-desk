import type { SkillReader } from "./generic-tool-support.js";
import type { AgentMetadata, MarkdownDefinitionLibrary } from "./markdown-definition-library.js";

export function agentSkillReader(
  library: MarkdownDefinitionLibrary,
  agent: AgentMetadata,
): SkillReader {
  const loadable = !agent.tools.includes("skill")
    ? []
    : agent.skills.length === 0
      ? library.skills
      : library.skills.filter((skill) => agent.skills.includes(skill.name));
  return {
    metadata: () => [...loadable],
    read: (name) => library.skill(name).body,
  };
}

export function agentInstructions(
  library: MarkdownDefinitionLibrary,
  agent: AgentMetadata,
): string {
  const body = library.agent(agent.name).body;
  if (agent.tools.includes("skill")) return body;
  return [
    body,
    ...agent.skills.map((name) => `## Skill: ${name}\n\n${library.skill(name).body}`),
  ].join("\n\n");
}
