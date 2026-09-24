import { afterEach, expect, test, vi } from "vitest";
import worker, { type Env } from "./index";

afterEach(() => vi.unstubAllGlobals());

test("the stats page opens only with a valid Access token", async () => {
  const algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  };
  const pair = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
  vi.stubGlobal("fetch", async () => Response.json({ keys: [jwk] }));
  const env: Env = {
    ASSETS: { fetch: async () => new Response("") },
    STATS: {
      prepare: () => {
        const statement = {
          bind: () => statement,
          run: async () => ({}),
          all: async () => ({ results: [] }),
        };
        return statement as never;
      },
    },
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
    ACCESS_AUD: "stats",
  };
  const encode = (value: object | ArrayBuffer) =>
    Buffer.from(
      value instanceof ArrayBuffer ? new Uint8Array(value) : JSON.stringify(value),
    ).toString("base64url");
  const token = async (aud: string) => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const unsigned = `${encode({ alg: "RS256", kid: "k1" })}.${encode({ aud: [aud], exp, iss: env.ACCESS_TEAM_DOMAIN })}`;
    const signature = await crypto.subtle.sign(
      algorithm,
      pair.privateKey,
      new TextEncoder().encode(unsigned),
    );
    return `${unsigned}.${encode(signature)}`;
  };
  const open = async (jwt?: string) => {
    const headers = jwt === undefined ? undefined : { "cf-access-jwt-assertion": jwt };
    const request = new Request("https://gardendesk.ai/admin/stats", { headers });
    return (await worker.fetch(request, env, { waitUntil: () => undefined })).status;
  };

  expect(await open()).toBe(403);
  expect(await open(await token("other"))).toBe(403);
  expect(await open(await token("stats"))).toBe(200);
});
