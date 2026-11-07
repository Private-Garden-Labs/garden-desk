import { randomUUID } from "node:crypto";
import type { CodeAgentLauncher } from "@gardendesk/workers";
import { isSuccessfulExecution } from "../agent/execution-success.js";
import { AGENT_WORKER_LIMITS } from "../agent/limits.js";
import { reviewExtractionSource } from "../commands/review-extraction.js";
import type { ExtractDocuments } from "./company-pack-build.js";

export function microVmExtraction(launcher: CodeAgentLauncher | undefined): ExtractDocuments {
  return async (folder, guestPaths) => {
    if (launcher === undefined) return guestPaths.map(() => undefined);
    const sessionId = randomUUID();
    const session = await launcher.openAgentSession({
      sessionId,
      sourceFolder: folder,
      readonlyInputs: [],
      limits: AGENT_WORKER_LIMITS,
    });
    try {
      const texts: Array<string | undefined> = [];
      for (const path of guestPaths) {
        const result = await session.execute({
          language: "python",
          path: ".garden-desk-tools/pack-extract.py",
          source: reviewExtractionSource(path, "/workspace/.garden-desk-tools/pack-extracted.txt"),
        });
        texts.push(
          isSuccessfulExecution(result) && result.stdoutTruncated !== true
            ? result.stdout
            : undefined,
        );
      }
      return texts;
    } finally {
      await session.close();
      await launcher.deleteWorkspace(sessionId);
    }
  };
}
