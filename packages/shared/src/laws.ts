import { z } from "zod";

export const JurisdictionSchema = z.enum(["us", "eu"]);

export const LawSourceSummarySchema = z.object({
  title: z.string(),
  version: z.string(),
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
