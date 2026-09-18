export const INFERENCE_PROFILE = {
  modelId: "ternary-bonsai-2-27b-pq2_0",
  name: "Ternary Bonsai 2 27B",
  projectorId: "ternary-bonsai-2-27b-mmproj-q8_0",
  contextTokens: 32_768,
  imageContextTokens: 8_192,
  imageTokens: 2_048,
  speculation: "none",
  memoryBudgetBytes: 16 * 1024 ** 3,
  windowsDedicatedHostMemoryBytes: 20 * 1024 ** 3,
  minimumUnifiedMemoryBytes: 24 * 1024 ** 3,
  minimumDedicatedMemoryBytes: 16_000_000_000,
  runtimeBuild: "llama.cpp@prism-b10685-7dffb15",
} as const;
