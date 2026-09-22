export const INFERENCE_PROFILE = {
  modelId: "ternary-bonsai-2-27b-pq2_0",
  name: "Ternary Bonsai 2 27B",
  projectorId: "ternary-bonsai-2-27b-mmproj-q8_0",
  minimumContextTokens: 32_768,
  maximumContextTokens: 262_144,
  contextStepTokens: 4_096,
  contextCacheBytesPerToken: { q4_0: 18 * 1024, q8_0: 34 * 1024 },
  serverFixedBytes: 512 * 1024 ** 2,
  contextReserveBytes: 2 * 1024 ** 3,
  imageContextTokens: 8_192,
  imageTokens: 2_048,
  speculation: "none",
  reasoningBudgetTokens: 32_768,
  thinkingBudgetTokens: { low: 512, medium: 2_048, xhigh: 8_192 },
  memoryBudgetBytes: 16 * 1024 ** 3,
  reducedMemoryBudgetBytes: 10 * 1024 ** 3,
  windowsDedicatedHostMemoryBytes: 20 * 1024 ** 3,
  minimumMacMemoryBytes: 16 * 1024 ** 3,
  fullBudgetMacMemoryBytes: 24 * 1024 ** 3,
  windowsIntegratedMemoryBytes: 24 * 1024 ** 3,
  /** Model, fixed server buffers, reserve, and the smallest context with a Q4 cache. */
  minimumDedicatedMemoryBytes: 10_494_503_264,
  runtimeBuild: "llama.cpp@prism-b10709-9a9394a",
} as const;

export type ContextCacheType = keyof typeof INFERENCE_PROFILE.contextCacheBytesPerToken;

/**
 * The larger Q8 context cache fits only in the full inference budget. A smaller
 * budget uses the Q4 cache that Windows already runs.
 */
export function contextCacheType(
  backend: "metal" | "cuda" | "hip",
  memoryBudgetBytes: number,
): ContextCacheType {
  return backend === "metal" && memoryBudgetBytes >= INFERENCE_PROFILE.memoryBudgetBytes
    ? "q8_0"
    : "q4_0";
}

/** Returns undefined when the budget cannot hold the model and the minimum context. */
export function fittedContextTokens(input: {
  memoryBudgetBytes: number;
  modelByteLength: number;
  cacheType: ContextCacheType;
}): number | undefined {
  const { minimumContextTokens, maximumContextTokens, contextStepTokens } = INFERENCE_PROFILE;
  const free =
    input.memoryBudgetBytes -
    input.modelByteLength -
    INFERENCE_PROFILE.serverFixedBytes -
    INFERENCE_PROFILE.contextReserveBytes;
  const tokens = Math.floor(free / INFERENCE_PROFILE.contextCacheBytesPerToken[input.cacheType]);
  const stepped = Math.floor(tokens / contextStepTokens) * contextStepTokens;
  if (stepped < minimumContextTokens) return undefined;
  return Math.min(maximumContextTokens, stepped);
}
