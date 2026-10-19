import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sampleFolderFileNames } from "./folder-files.js";

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "garden-desk-sample-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("sampleFolderFileNames", () => {
  it("returns 10 names without hidden files or linked folders", async () => {
    const selected = temporaryRoot();
    const outside = temporaryRoot();
    writeFileSync(join(outside, "secret.pdf"), "x");
    writeFileSync(join(selected, ".env"), "x");
    writeFileSync(join(selected, "a.pdf"), "x");
    symlinkSync(
      outside,
      join(selected, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    mkdirSync(join(selected, "sub"));
    for (let index = 0; index < 12; index++) {
      writeFileSync(join(selected, "sub", `f${String(index).padStart(2, "0")}.txt`), "x");
    }

    const names = await sampleFolderFileNames(selected, 10);
    expect(names).toHaveLength(10);
    expect(names).toContain("a.pdf");
    expect(names).not.toContain(".env");
    expect(names).not.toContain("secret.pdf");
    expect(names).not.toContain("linked");
  });
});
