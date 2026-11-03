import {
  type InferenceDiagnosticOperation,
  recordDevelopmentHostFailure,
  waitForDevelopmentHostRecord,
} from "@gardendesk/workers";
import { InferenceFailure } from "./inference-errors.js";
import type { ModelResolver, StagedModel } from "./models.js";
import type { ResourceScheduler } from "./scheduler.js";

export interface ResidentModel {
  modelId: string;
  operation: InferenceDiagnosticOperation;
  stagedModel: StagedModel;
  lease: ReturnType<ResourceScheduler["reserve"]>;
}

async function recordModelPreparationFailure(
  operation: InferenceDiagnosticOperation,
  error: unknown,
): Promise<void> {
  try {
    if (globalThis.__GARDEN_DESK_DEVELOPMENT_BUILD__ === true)
      await waitForDevelopmentHostRecord(
        recordDevelopmentHostFailure("model_prepare", operation, error),
      );
  } catch {
    // Diagnostics must not change inference behavior.
  }
}
function modelPreparationFailure(error: unknown): InferenceFailure {
  try {
    if (error instanceof Error && error.message === "missing_model")
      return new InferenceFailure("not_found", "Inference model unavailable.");
    if (error instanceof Error && /memory/iu.test(error.message))
      return new InferenceFailure("out_of_memory", "Inference memory unavailable.");
  } catch {
    // Return the fixed inference error below.
  }
  return new InferenceFailure("internal", "Inference failed.");
}

export async function stageResidentModel(
  ports: { models: ModelResolver; scheduler: ResourceScheduler },
  modelId: string,
  operation: InferenceDiagnosticOperation,
  signal: AbortSignal,
): Promise<ResidentModel> {
  const lease = ports.scheduler.reserve(operation);
  try {
    return { modelId, operation, stagedModel: await ports.models.resolve(modelId, signal), lease };
  } catch (error) {
    lease.release();
    await recordModelPreparationFailure(operation, error);
    throw modelPreparationFailure(error);
  }
}

export async function releaseResidentModel(model: ResidentModel | undefined): Promise<void> {
  if (model === undefined) return;
  try {
    await model.stagedModel.dispose();
  } finally {
    model.lease.release();
  }
}
