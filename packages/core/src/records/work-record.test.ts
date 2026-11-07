import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { AgentStore } from "../agent/store.js";
import { AuditLog } from "../audit/log.js";
import { ConversationStore } from "../conversations/store.js";
import { JobStore } from "../jobs/jobs.js";
import { ArtifactStore } from "../workspace/artifacts.js";
import { openWorkspaceCatalog } from "../workspace/catalog.js";
import { WorkspaceScope } from "../workspace/scope.js";
import { exportWorkRecord } from "./work-record.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const LABELS = {
  asked: "What you asked",
  did: "What Garden Desk did",
  files: "Files read and written",
  law: "Rules and law consulted",
  audit: "Audit",
  chainVerified: "Audit chain verified",
  yes: "yes",
  no: "no",
};

it("exports an audited work record of a session", async () => {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-work-record-"));
  roots.push(root);
  const scope = await WorkspaceScope.create(root);
  const catalog = openWorkspaceCatalog(scope.root);
  const audit = new AuditLog(catalog.database);
  const artifacts = await ArtifactStore.create(scope);
  const store = new AgentStore(catalog.database, artifacts, (event) => audit.append(event));
  const conversations = new ConversationStore(catalog.database);
  const session = conversations.createSession(null);
  conversations.appendMessage(session.id, "user", "Check the lease");
  const run = store.createRun(session.id, new JobStore(catalog.database).create("agent", "j").id);
  store.appendEvent(run.id, "tool.completed", "Read /source/lease.txt.", {
    toolName: "read",
    argumentsHash: "sha256:abc",
  });
  store.appendEvent(run.id, "question.asked", "Waiting for your answer.");
  store.appendEvent(run.id, "question.answered", "Question answered.", { stdout: "Yes" });
  store.addArtifact(run.id, {
    name: "notes.md",
    mediaType: "text/markdown",
    byteLength: 5,
    contentHash: await artifacts.put(Buffer.from("notes")),
  });
  audit.append({
    type: "pack.searched",
    outcome: "succeeded",
    metadata: { sessionId: session.id, runId: run.id, jurisdiction: "eu", citations: "Art. 5" },
  });

  const result = await exportWorkRecord({ audit, conversations, store }, session.id, root, LABELS);
  const record = await readFile(join(root, result.file), "utf8");

  expect(result.verified).toBe(true);
  expect(record).toMatch(
    /## What you asked\n\n> Check the lease\n\n## What Garden Desk did[\s\S]*- read: Read \/source\/lease.txt.\n- Asked you a question.\n- You answered: Yes[\s\S]*## Files read and written\n\n- Read \/source\/lease.txt.\n- Created notes.md \(5 bytes\)\n\n## Rules and law consulted\n\n- eu: Art. 5\n\n## Audit\n\n- Audit chain verified: yes/u,
  );
  expect(audit.sessionEvents(session.id).map((event) => event.type)).toEqual([
    "tool.called",
    "question.answered",
    "artifact.created",
    "pack.searched",
    "session.exported",
  ]);
  expect(audit.verify()).toBe(true);
  catalog.close();
});
