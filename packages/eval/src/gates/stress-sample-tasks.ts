import { cp } from "node:fs/promises";
import { join } from "node:path";
import { cases } from "../stress/sample-cases.js";
import type { StressTask } from "./stress-comparison-tasks.js";

const samples = join(process.cwd(), "samples");

/** Tasks from the samples folder; the answer is the chat response and any text file it saved. */
export const sampleTasks: StressTask[] = cases.map((task) => ({
  id: task.id,
  suite: "sample",
  agentId: task.agentId,
  deliverable: "response",
  expectation: `${task.checks.length} facts`,
  prompt: task.prompt,
  ...(task.command === undefined ? {} : { command: task.command }),
  ...(task.attachments === undefined ? {} : { attachments: task.attachments }),
  prepare: async (sourceDir) => {
    const folders = task.folders ?? [];
    for (const folder of folders)
      await cp(join(samples, folder), folders.length === 1 ? sourceDir : join(sourceDir, folder), {
        recursive: true,
      });
    for (const file of task.attachments ?? [])
      await cp(join(samples, "documents", file), join(sourceDir, file));
  },
  afterGrant: async () => undefined,
  check: ({ text }) => {
    const normalized = text.replace(/(\d),(?=\d{3}\b)/gu, "$1");
    const found = task.checks.filter((check) => check.test(normalized)).length;
    return { facts: found / task.checks.length, sources: 1 };
  },
}));
