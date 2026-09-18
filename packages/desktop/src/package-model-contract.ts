import { join } from "node:path";
import { INFERENCE_PROFILE } from "@gardendesk/shared";

export const generationModelId = INFERENCE_PROFILE.modelId;
export const generationModelFileName = `${generationModelId}.gguf`;
export const generationModelResourcePath = `models/${generationModelFileName}`;
export const projectorModelId = INFERENCE_PROFILE.projectorId;
export const projectorModelFileName = `${projectorModelId}.gguf`;
export const projectorModelResourcePath = `models/${projectorModelFileName}`;
export const draftModelId = INFERENCE_PROFILE.multiTokenPredictionId;
export const draftModelFileName = `${draftModelId}.gguf`;
export const draftModelResourcePath = `models/${draftModelFileName}`;
export const packagedModelFiles = [
  {
    id: generationModelId,
    fileName: generationModelFileName,
    resourcePath: generationModelResourcePath,
  },
  {
    id: projectorModelId,
    fileName: projectorModelFileName,
    resourcePath: projectorModelResourcePath,
  },
  {
    id: draftModelId,
    fileName: draftModelFileName,
    resourcePath: draftModelResourcePath,
  },
] as const;

export function canonicalModelPath(repositoryRoot: string, fileName: string): string {
  return join(repositoryRoot, "packages", "eval", ".generated", "models", fileName);
}

export function packagedModelPath(resourcesRoot: string, fileName: string): string {
  return join(resourcesRoot, "models", fileName);
}

export function canonicalGenerationModelPath(repositoryRoot: string): string {
  return canonicalModelPath(repositoryRoot, generationModelFileName);
}

export function canonicalProjectorModelPath(repositoryRoot: string): string {
  return canonicalModelPath(repositoryRoot, projectorModelFileName);
}

export function canonicalDraftModelPath(repositoryRoot: string): string {
  return canonicalModelPath(repositoryRoot, draftModelFileName);
}

export function packagedGenerationModelPath(resourcesRoot: string): string {
  return packagedModelPath(resourcesRoot, generationModelFileName);
}

export function packagedProjectorModelPath(resourcesRoot: string): string {
  return packagedModelPath(resourcesRoot, projectorModelFileName);
}

export function generationModelPackageFile(repositoryRoot: string): {
  source: string;
  path: string;
} {
  return {
    source: canonicalGenerationModelPath(repositoryRoot),
    path: generationModelResourcePath,
  };
}

export function modelPackageFiles(repositoryRoot: string): Array<{ source: string; path: string }> {
  return [
    generationModelPackageFile(repositoryRoot),
    { source: canonicalProjectorModelPath(repositoryRoot), path: projectorModelResourcePath },
    { source: canonicalDraftModelPath(repositoryRoot), path: draftModelResourcePath },
  ];
}
