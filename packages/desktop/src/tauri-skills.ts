import { SkillLocationsSchema, SkillSummarySchema } from "@gardendesk/shared";
import type { DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";
import { record } from "./tauri-parse.js";

type SkillApi = Pick<
  DesktopApi,
  | "listSkills"
  | "chooseSkillFiles"
  | "addSkillFiles"
  | "readSkill"
  | "writeSkill"
  | "removeSkill"
  | "setSkillEnabled"
  | "skillLocations"
  | "openPromptFolder"
>;

export const tauriSkillApi: SkillApi = {
  async listSkills() {
    return invokeDesktop("list_skills", (value) => SkillSummarySchema.array().parse(value));
  },
  async chooseSkillFiles() {
    return invokeDesktop("choose_skill_files", (value) =>
      value === null ? undefined : SkillSummarySchema.array().parse(value),
    );
  },
  async addSkillFiles(paths) {
    return invokeDesktop("add_skill_files", (value) => SkillSummarySchema.array().parse(value), {
      paths,
    });
  },
  async readSkill(name) {
    return invokeDesktop(
      "read_skill",
      (value) => {
        const { content } = record(value);
        if (typeof content !== "string") throw new Error("The skill file could not be read.");
        return content;
      },
      { name },
    );
  },
  async writeSkill(name, content) {
    return invokeDesktop("write_skill", (value) => record(value).saved === true, { name, content });
  },
  async removeSkill(name) {
    return invokeDesktop("remove_skill", (value) => record(value).removed === true, { name });
  },
  async setSkillEnabled(name, enabled) {
    return invokeDesktop("set_skill_enabled", (value) => record(value).changed === true, {
      name,
      enabled,
    });
  },
  async skillLocations() {
    return invokeDesktop("skill_locations", (value) => SkillLocationsSchema.parse(value));
  },
  async openPromptFolder(folder) {
    await invokeDesktop("open_prompt_folder", () => undefined, { folder });
  },
};
