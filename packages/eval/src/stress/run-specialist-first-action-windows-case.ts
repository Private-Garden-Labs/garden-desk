import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import { runDevelopmentHeadlessEntry } from "../gates/development-inference.js";

const repository = process.cwd();
const inferenceWorker = join(
  repository,
  "packages/eval/.generated/specialist-first-action-inference/worker.mjs",
);

await mkdir(dirname(inferenceWorker), { recursive: true });
await build({
  absWorkingDir: repository,
  bundle: true,
  define: {
    "globalThis.__GARDEN_DESK_DEVELOPMENT_BUILD__": "true",
    "globalThis.__GARDEN_DESK_DEVELOPMENT_DIAGNOSTIC_ROOT__": JSON.stringify(""),
  },
  entryPoints: [join(repository, "packages/workers/src/inference/worker.ts")],
  format: "esm",
  minifySyntax: true,
  outfile: inferenceWorker,
  platform: "node",
  target: "node24",
});

await runDevelopmentHeadlessEntry(
  new URL("./specialist-first-action-windows-case.ts", import.meta.url),
  "specialist_first_action_case_failed",
);
