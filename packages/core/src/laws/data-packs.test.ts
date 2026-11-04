import { generateKeyPairSync, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readdir } from "node:fs/promises";
import { get } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { expect, it, vi } from "vitest";
import { type DataPackInstall, DataPackStore } from "./data-packs.js";

vi.mock("node:https", () => ({ get: vi.fn() }));

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
  vi.mocked(get).mockImplementation(((
    url: string,
    _options: unknown,
    respond: (response: Readable) => void,
  ) => {
    const body = url.endsWith("/catalog")
      ? JSON.stringify({
          catalog,
          signature: sign(null, Buffer.from(catalog), signer).toString("base64"),
        })
      : "altered";
    respond(Object.assign(Readable.from([body]), { statusCode: 200 }));
    return new EventEmitter();
  }) as never);
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
