import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevelopmentPorts } from "../development/ports.js";
import type { GardenDeskCore } from "../facade.js";
import { dispatchRpc } from "./methods.js";

const DEVELOPMENT_METHODS = [
  "development.models.settings",
  "development.models.search",
  "development.models.save",
];
const roots: string[] = [];

function request(method: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method,
    params: { query: "vendor", favorites: [] },
    protocolVersion: 1,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true })));
});

describe("development model methods", () => {
  it("refuses a production build even when cloud settings are present", async () => {
    const root = await mkdtemp(join(tmpdir(), "garden-desk-development-"));
    roots.push(root);
    const requests = vi.spyOn(globalThis, "fetch");
    const development = createDevelopmentPorts(root, () => undefined);
    await development.saveModelSettings({
      favorites: [{ id: "vendor/model", name: "Vendor Model", contextTokens: 128_000 }],
      apiKey: "sk-or-development-key",
    });
    expect(await development.modelSettings()).toMatchObject({
      keyPresent: true,
      keyLastFour: "-key",
    });

    const production = { development: undefined } as unknown as GardenDeskCore;
    for (const method of DEVELOPMENT_METHODS) {
      expect(await dispatchRpc(production, request(method))).toMatchObject({
        error: { code: "unsupported" },
      });
    }
    expect(requests).not.toHaveBeenCalled();
  });
});
