import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { type DataPackInstall, DataPackStore } from "./data-packs.js";

afterEach(() => vi.unstubAllGlobals());

it("installs nothing from a forged catalog or an archive that does not match it", async () => {
  const root = await mkdtemp(join(tmpdir(), "garden-desk-data-packs-"));
  const trusted = generateKeyPairSync("ed25519");
  const forger = generateKeyPairSync("ed25519");
  const pack = {
    id: "eu",
    jurisdiction: "eu",
    name: "European Union",
    currentAsOf: "2026-11-01",
    access: "free",
    file: "eu-1.zip",
    bytes: 7,
    sha256: "0".repeat(64),
  };
  const catalog = JSON.stringify({ packs: [pack] });
  let signer = forger.privateKey;
  vi.stubGlobal("fetch", async (url: string) =>
    url.endsWith("/catalog")
      ? Response.json({
          catalog,
          signature: sign(null, Buffer.from(catalog), signer).toString("base64"),
        })
      : new Response("altered"),
  );
  const results: DataPackInstall[] = [];
  const store = new DataPackStore(
    root,
    trusted.publicKey,
    () => undefined,
    (result) => results.push(result),
  );

  expect((await store.list()).online).toBe(false);
  await expect(store.install("eu")).rejects.toThrow("invalid");

  signer = trusted.privateKey;
  expect(await store.install("eu")).toBe(true);
  await vi.waitFor(() => expect(results).toHaveLength(1));
  expect(results[0]?.failure).toBe("invalid");
  expect(await readdir(root)).toEqual([]);
});
