import type { SkillStore } from "./agent/skill-store.js";
import type { AuditLog } from "./audit/log.js";
import type { GardenDeskCorePorts } from "./facade.js";

export type SkillPorts = Pick<
  GardenDeskCorePorts,
  | "listSkills"
  | "installSkills"
  | "readSkill"
  | "writeSkill"
  | "removeSkill"
  | "setSkillEnabled"
  | "skillLocations"
>;

export function createSkillPorts(skills: SkillStore, audit: AuditLog): SkillPorts {
  const record = (type: string, metadata: Record<string, string | boolean>) =>
    audit.append({ type, outcome: "succeeded", metadata });
  return {
    listSkills: async () => skills.list(),
    async installSkills(paths) {
      const entries = skills.install(paths);
      record("skills.installed", { fileCount: String(paths.length) });
      return entries;
    },
    readSkill: async (name) => skills.read(name),
    async writeSkill(name, content) {
      const saved = skills.write(name, content);
      record("skill.edited", { name });
      return saved;
    },
    async removeSkill(name) {
      const removed = skills.remove(name);
      record("skill.removed", { name, removed });
      return removed;
    },
    async setSkillEnabled(name, enabled) {
      const changed = skills.setEnabled(name, enabled);
      record("skill.availability_changed", { name, enabled });
      return changed;
    },
    skillLocations: async () => skills.locations(),
  };
}
