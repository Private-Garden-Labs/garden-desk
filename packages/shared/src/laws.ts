import { z } from "zod";

export const LawJurisdictionSchema = z.enum(["us", "eu", "ro"]);
export const CompanyPackIdSchema = z.templateLiteral([
  "company:",
  z.string().regex(/^[a-z0-9-]+$/u),
]);
export const JurisdictionSchema = z.union([LawJurisdictionSchema, CompanyPackIdSchema]);

export const LAW_PACK_DIRECTORIES = { us: "us-federal", eu: "eu", ro: "romania" } as const;

export function packDirectory(id: z.infer<typeof JurisdictionSchema>): string {
  return id.startsWith("company:")
    ? `company/${id.slice("company:".length)}`
    : LAW_PACK_DIRECTORIES[id as z.infer<typeof LawJurisdictionSchema>];
}

export const LawSourceSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  url: z.string(),
  enabled: z.boolean(),
});

export const LawJurisdictionSummarySchema = z.object({
  id: JurisdictionSchema,
  name: z.string(),
  currentAsOf: z.string(),
  enabled: z.boolean(),
  sources: z.array(LawSourceSummarySchema),
});

export const LawActSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  url: z.string(),
  sections: z.array(z.object({ citation: z.string(), heading: z.string(), text: z.string() })),
});

export const LawCitationsSchema = z.array(
  z.object({
    jurisdiction: JurisdictionSchema,
    source: z.string(),
    citations: z.array(z.string()),
  }),
);

export const LAW_DISCLAIMER =
  "Not legal advice. Garden Desk checks only the laws it includes and can make mistakes. Check every finding against the official text or with a lawyer.";

export type Jurisdiction = z.infer<typeof JurisdictionSchema>;
export type LawJurisdictionSummary = z.infer<typeof LawJurisdictionSummarySchema>;
export type LawAct = z.infer<typeof LawActSchema>;
export type LawCitations = z.infer<typeof LawCitationsSchema>;

export const DataPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  jurisdiction: JurisdictionSchema,
  name: z.string(),
  currentAsOf: z.string(),
  access: z.enum(["free", "key"]),
  file: z.string().regex(/^[a-z0-9-]+\.(zip|gdpack)$/u),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  publisher: z.string().min(1).default("Garden Desk"),
  kind: z.enum(["law", "company"]).default("law"),
});

export const CompanyPackManifestSchema = DataPackSchema.extend({
  jurisdiction: CompanyPackIdSchema,
  kind: z.literal("company"),
  publicKey: z.string().min(1),
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

export const CompanyPackImportSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("importing") }),
  z.object({ status: z.literal("installed"), id: CompanyPackIdSchema }),
  z.object({
    status: z.literal("untrusted"),
    path: z.string(),
    publisher: z.string(),
    fingerprint: z.string(),
  }),
  z.object({ status: z.literal("invalid") }),
  z.object({ status: z.literal("failed"), reason: z.string() }),
]);

export const CompanyPackBuildSchema = z.union([
  z.object({ state: z.enum(["idle", "building"]) }),
  z.object({ state: z.literal("failed"), reason: z.string() }),
  z.object({
    state: z.literal("built"),
    path: z.string(),
    sections: z.number().int(),
    skipped: z.number().int(),
  }),
]);

export const CompanyPacksSchema = z.object({
  folder: z.string().nullable(),
  files: z.array(z.object({ name: z.string(), path: z.string() })),
  build: CompanyPackBuildSchema,
  import: CompanyPackImportSchema,
});

export type DataPack = z.infer<typeof DataPackSchema>;
export type DataPackStatus = z.infer<typeof DataPackStatusSchema>;
export type DataPacks = z.infer<typeof DataPacksSchema>;
export type CompanyPackManifest = z.infer<typeof CompanyPackManifestSchema>;
export type CompanyPackImport = z.infer<typeof CompanyPackImportSchema>;
export type CompanyPackBuild = z.infer<typeof CompanyPackBuildSchema>;
export type CompanyPacks = z.infer<typeof CompanyPacksSchema>;
