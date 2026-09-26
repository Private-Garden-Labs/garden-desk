// biome-ignore lint/style/noRestrictedImports: the routing test uses a temporary command definition.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { CommandLibrary } from "../commands/library.js";
import type { ChatInput } from "../runtime/inference.js";
import { ArtifactStore } from "../workspace/artifacts.js";
import { openWorkspaceCatalog } from "../workspace/catalog.js";
import { WorkspaceScope } from "../workspace/scope.js";
import {
  artifactExecution,
  chatResult,
  cleanServiceFixtures,
  fixture,
  terminal,
} from "./service-test-support.js";
import { AgentStore } from "./store.js";

afterEach(cleanServiceFixtures);

it("returns every child answer from one turn after the completion check", async () => {
  const answers = ["", "First answer.", "Second answer.", "yes"];
  let turn = 0;
  const { catalog, conversations, service } = await fixture(
    {
      async chat() {
        turn += 1;
        if (turn > 1) return chatResult(answers[turn - 1] ?? "", []);
        return chatResult(
          "",
          [1, 2].map((part) => ({
            id: `part-${part}`,
            name: "task",
            params: {
              subagent_type: "matter-chronology",
              description: `Part ${part}`,
              prompt: `Do part ${part}.`,
            },
          })),
        );
      },
    },
    artifactExecution,
  );
  try {
    const run = service.start(conversations.createSession(null).id, "Do both parts.");
    expect((await terminal(service, run.id)).run.response).toBe("First answer.\n\nSecond answer.");
    expect(turn).toBe(4);
  } finally {
    await service.close();
    catalog.close();
  }
});

it("uses the parent index when loading child runs", async () => {
  const { catalog, service } = await fixture({}, artifactExecution);
  try {
    const plan = catalog.database
      .prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM agent_runs WHERE parent_run_id = ? ORDER BY created_at, id",
      )
      .all("parent-run");
    expect(plan).toMatchObject([
      { detail: "SEARCH agent_runs USING INDEX agent_runs_by_parent (parent_run_id=?)" },
    ]);
  } finally {
    await service.close();
    catalog.close();
  }
});

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: one case checks the shared delegation and command boundary through reopening.
it("returns a good enough child answer unchanged and runs a command specialist in the same run", async () => {
  const requests: ChatInput[] = [];
  const description = "Inspect source structure".padEnd(1_000, ".");
  const prompt = "Inspect the selected files.".padEnd(128_000, ".");
  const assignment = `${description}\n\n${prompt}`;
  const commandDescription = description.slice(0, 256);
  const commandArguments = prompt.padEnd(256_000 - "/intake ".length, ".");
  const commandTask = `/intake ${commandArguments}`;
  let parentId = "";
  const { catalog, conversations, service } = await fixture(
    {
      async chat(request, _signal, streams) {
        requests.push(request);
        if (requests.length === 1) {
          const task = request.tools.find((tool) => tool.name === "task");
          expect(task?.params.properties).toHaveProperty(
            "subagent_type.enum",
            expect.arrayContaining(["matter-chronology"]),
          );
          return chatResult("", [
            {
              id: "intake-call",
              name: "task",
              params: {
                subagent_type: "matter-chronology",
                description,
                prompt,
              },
            },
          ]);
        }
        if (requests.length === 3) {
          expect(request.tools).toEqual([]);
          return chatResult("yes", []);
        }
        expect(request.tools.some((tool) => tool.name === "task" || tool.name === "question")).toBe(
          false,
        );
        streams?.onResponseDelta?.("Partial findings.");
        const assigned = request.messages.find((message) => message.role === "user")?.text;
        if (assigned?.startsWith(`${assignment}\n\n`)) {
          const child = service.snapshot(parentId).childRuns[0];
          expect(child).toMatchObject({ agentId: "matter-chronology", state: "running" });
          if (child === undefined) throw new Error("Child was not recorded.");
          expect(service.snapshot(child.id).run.response).toBe("Partial findings.");
        } else {
          expect(service.snapshot(parentId).childRuns).toHaveLength(0);
          expect(service.snapshot(parentId).run.response).toBe("Partial findings.");
        }
        return chatResult("Complete findings.", []);
      },
    },
    artifactExecution,
  );
  const row = catalog.database.prepare("PRAGMA database_list").get() as { file: string };
  const root = dirname(dirname(row.file));
  const commandRoot = join(root, "test-commands");
  await mkdir(commandRoot);
  await writeFile(
    join(commandRoot, "intake.md"),
    `---\ndescription: ${commandDescription}\nagent: matter-chronology\n---\n`,
  );
  const command = new CommandLibrary(commandRoot).resolve(commandTask);
  const resolveCommand = vi
    .spyOn(CommandLibrary.prototype, "resolve")
    .mockReturnValueOnce(undefined)
    .mockReturnValue(command);
  try {
    const session = conversations.createSession(null);
    parentId = service.start(session.id, "Inspect source structure.").id;
    const delegated = await terminal(service, parentId);
    expect(delegated.run).toMatchObject({
      state: "succeeded",
      error: null,
      response: "Complete findings.",
    });
    expect(delegated.childRuns[0]?.assignment).toHaveLength(assignment.length);
    expect(delegated.childRuns[0]).toMatchObject({
      assignment,
      parentRunId: parentId,
      parentToolCallId: "intake-call",
      response: "Complete findings.",
    });
    parentId = service.start(session.id, commandTask).id;
    const direct = await terminal(service, parentId);
    expect(direct.run).toMatchObject({
      state: "succeeded",
      response: "Complete findings.",
      agentId: "matter-chronology",
    });
    expect(direct.childRuns).toHaveLength(0);
    expect(requests).toHaveLength(4);
    expect(requests[1]?.messages.find((message) => message.role === "user")?.text).toBe(
      `${assignment}\n\nThe user's request, word for word:\nInspect source structure.`,
    );
    expect(requests[3]?.messages.filter((message) => message.role === "user")).toMatchObject([
      { text: `${commandDescription}\n\n${commandArguments}` },
    ]);
    expect(service.listRuns(session.id).map((run) => run.id)).toEqual(
      expect.arrayContaining([delegated.run.id, direct.run.id]),
    );
    expect(service.listRuns(session.id)).toHaveLength(2);
    await service.close();
    catalog.close();
    const reopened = openWorkspaceCatalog(root);
    try {
      const store = new AgentStore(
        reopened.database,
        await ArtifactStore.create(await WorkspaceScope.create(root)),
      );
      expect(store.snapshot(parentId).childRuns).toEqual(direct.childRuns);
      expect(store.snapshot(delegated.run.id).childRuns).toEqual(delegated.childRuns);
    } finally {
      reopened.close();
    }
  } finally {
    resolveCommand.mockRestore();
    await service.close();
    catalog.close();
  }
});
