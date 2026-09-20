import { z } from "zod";

export const SkillNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  .max(64);

export const SkillSourceSchema = z.enum(["built-in", "customized", "installed"]);

export const SkillSummarySchema = z.object({
  description: z.string().max(1024),
  enabled: z.boolean(),
  name: SkillNameSchema,
  path: z.string(),
  source: SkillSourceSchema,
  valid: z.boolean(),
});

export const SkillLocationsSchema = z.object({
  builtInSkillsPath: z.string(),
  skillsPath: z.string(),
  systemPromptsPath: z.string(),
});

export type SkillLocations = z.infer<typeof SkillLocationsSchema>;
export type SkillSource = z.infer<typeof SkillSourceSchema>;
export type SkillSummary = z.infer<typeof SkillSummarySchema>;
