import { z } from "zod";

/** Development-only cloud model selection. Production builds never read these values. */
export const MAX_DEVELOPMENT_MODEL_FAVORITES = 20;
export const DEVELOPMENT_MODEL_SEARCH_LIMIT = 10;

export const DevelopmentModelSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  contextTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export const DevelopmentModelListSchema = DevelopmentModelSchema.array().max(
  MAX_DEVELOPMENT_MODEL_FAVORITES,
);

export const DevelopmentModelSettingsSchema = z.object({
  favorites: DevelopmentModelListSchema,
  keyPresent: z.boolean(),
  keyLastFour: z.string().length(4).optional(),
});

export type DevelopmentModel = z.infer<typeof DevelopmentModelSchema>;
export type DevelopmentModelSettings = z.infer<typeof DevelopmentModelSettingsSchema>;
