export const INFERENCE_PROFILE = {
  modelId: "ternary-bonsai-2-27b-pq2_0",
  name: "Ternary Bonsai 2 27B",
  projectorId: "ternary-bonsai-2-27b-mmproj-q8_0",
  minimumContextTokens: 32_768,
  maximumContextTokens: 131_072,
  contextStepTokens: 4_096,
  /** Measured on the pinned build: an FP16 cache costs 64 KiB for each token. */
  contextCacheBytesPerToken: 64 * 1024,
  /**
   * The compute buffers grow with the context; the rest of the server does not.
   * Both backends hold an FP16 attention mask of 2 bytes for each token of the
   * fixed 256-token micro-batch. Metal also keeps one attention layer of the
   * cache as scratch. These values need a new measurement if the micro-batch in
   * `serverArguments` changes.
   */
  computeBytesPerToken: { metal: 5 * 1024, cuda: 512, hip: 512 },
  fixedServerBytes: 512 * 1024 ** 2,
  /** Fragmentation, and memory another program takes after the free-memory reading. */
  safetyMarginBytes: 512 * 1024 ** 2,
  imageContextTokens: 8_192,
  imageTokens: 2_048,
  speculation: "none",
  reasoningBudgetTokens: 32_768,
  memoryBudgetBytes: 16 * 1024 ** 3,
  reducedMemoryBudgetBytes: 10 * 1024 ** 3,
  windowsDedicatedHostMemoryBytes: 20 * 1024 ** 3,
  minimumMacMemoryBytes: 16 * 1024 ** 3,
  fullBudgetMacMemoryBytes: 24 * 1024 ** 3,
  windowsIntegratedMemoryBytes: 24 * 1024 ** 3,
  /** Model, fixed buffers, margin, and the smallest supported context. */
  minimumDedicatedMemoryBytes: 10_444_171_616,
  runtimeBuild: "llama.cpp@prism-b10709-9a9394a",
} as const;

/** Returns undefined when the budget cannot hold the model and the minimum context. */
export function fittedContextTokens(input: {
  backend: "metal" | "cuda" | "hip";
  memoryBudgetBytes: number;
  modelByteLength: number;
}): number | undefined {
  const { minimumContextTokens, maximumContextTokens, contextStepTokens } = INFERENCE_PROFILE;
  const free =
    input.memoryBudgetBytes -
    input.modelByteLength -
    INFERENCE_PROFILE.fixedServerBytes -
    INFERENCE_PROFILE.safetyMarginBytes;
  const bytesPerToken =
    INFERENCE_PROFILE.contextCacheBytesPerToken +
    INFERENCE_PROFILE.computeBytesPerToken[input.backend];
  const tokens = Math.floor(free / bytesPerToken);
  const stepped = Math.floor(tokens / contextStepTokens) * contextStepTokens;
  if (stepped < minimumContextTokens) return undefined;
  return Math.min(maximumContextTokens, stepped);
}
