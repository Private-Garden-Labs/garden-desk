import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { runtimeResourceDirectories, runtimeResourceNames } from "../package-image-resources.js";
import { copyLawLibrary } from "../package-law-resources.js";

it("rejects a law library until its sections have vectors", async () => {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-law-package-"));
  const source = join(root, "source.sqlite");
  const destination = join(root, "packaged.sqlite");
  const database = new DatabaseSync(source);
  try {
    database.exec(`
      CREATE TABLE sections (id INTEGER PRIMARY KEY);
      CREATE TABLE chunks (section_id INTEGER, vector BLOB);
      INSERT INTO sections VALUES (1);
    `);
    await expect(copyLawLibrary(source, destination)).rejects.toThrow("vectors");
    database.prepare("INSERT INTO chunks VALUES (1, ?)").run(new Uint8Array(4));
    await copyLawLibrary(source, destination);
    expect(await readFile(destination)).toEqual(await readFile(source));
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

describe("desktop inference runtime resources", () => {
  it("selects only the allowlisted files for each package target", async () => {
    const manifest = JSON.parse(
      await readFile(join(process.cwd(), "assets/inference-runtime.json"), "utf8"),
    );
    const mac = runtimeResourceNames(manifest, "macos-arm64");
    const windows = runtimeResourceNames(manifest, "windows-hip-x64");

    expect(mac).toContain("llama-server");
    expect(windows).toContain("llama-server.exe");
    expect(windows).toContain("ggml-hip.dll");
    expect(windows).toContain("rocblas.dll");
    expect(windows).toContain("vcruntime140_1.dll");
    expect(new Set(windows).size).toBe(windows.length);
    expect(runtimeResourceDirectories(manifest, "windows-hip-x64")).toEqual([
      "hipblaslt/library",
      "rocblas/library",
    ]);
  });

  it("rejects a runtime file outside the generated runtime folder", () => {
    expect(() =>
      runtimeResourceNames(
        {
          platforms: {
            test: {
              executable: "runtime",
              files: { executable: "runtime", library: "../library" },
              stagedSha256: "",
            },
          },
        },
        "test",
      ),
    ).toThrow("manifest is invalid");
  });
});
