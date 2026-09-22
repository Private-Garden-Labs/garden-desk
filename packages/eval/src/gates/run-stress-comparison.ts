import { runDevelopmentHeadlessEntry } from "./development-inference.js";

await runDevelopmentHeadlessEntry(
  new URL("./stress-comparison.ts", import.meta.url),
  "stress_comparison_failed",
);
