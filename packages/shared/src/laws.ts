import { z } from "zod";

export const JurisdictionSchema = z.enum(["us", "eu", "ro"]);

export const LAW_PACK_DIRECTORIES = { us: "us-federal", eu: "eu", ro: "romania" } as const;

export const LawSourceSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  enabled: z.boolean(),
});

export const LawJurisdictionSummarySchema = z.object({
  id: JurisdictionSchema,
  name: z.string(),
  currentAsOf: z.string(),
  enabled: z.boolean(),
  sources: z.array(LawSourceSummarySchema),
});

export const LAW_DISCLAIMER =
  "Not legal advice. Garden Desk checks only the laws it includes and can make mistakes. Check every finding against the official text or with a lawyer.";

export type Jurisdiction = z.infer<typeof JurisdictionSchema>;
export type LawJurisdictionSummary = z.infer<typeof LawJurisdictionSummarySchema>;

export const DataPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  jurisdiction: JurisdictionSchema,
  name: z.string(),
  currentAsOf: z.string(),
  access: z.enum(["free", "key"]),
  file: z.string().regex(/^[a-z0-9-]+\.zip$/u),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const DataPackStatusSchema = DataPackSchema.omit({ file: true, sha256: true }).extend({
  state: z.enum(["available", "downloading", "installed", "update"]),
  failure: z.enum(["key", "unavailable", "invalid"]).optional(),
});

export const DataPacksSchema = z.object({
  keySaved: z.boolean(),
  online: z.boolean(),
  packs: z.array(DataPackStatusSchema),
});

export type DataPack = z.infer<typeof DataPackSchema>;
export type DataPackStatus = z.infer<typeof DataPackStatusSchema>;
export type DataPacks = z.infer<typeof DataPacksSchema>;
