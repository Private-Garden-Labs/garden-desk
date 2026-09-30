import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, test, vi } from "vitest";
import template from "../blog/index.html?raw";
import worker, { type Env } from "./index";
import blogSchema from "./migrations/0002_blog_posts.sql?raw";

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
    const request = new Request("https://admin.gardendesk.ai/stats/", { headers });
    return (await worker.fetch(request, env, { waitUntil: () => undefined })).status;
  };

  expect(await open()).toBe(403);
  expect(await open(await token("other"))).toBe(403);
  expect(await open(await token("stats"))).toBe(200);
});

test("only the signed-in admin can publish safe Markdown, and drafts stay private", async () => {
  const db = new DatabaseSync(":memory:");
  const env = blogEnvironment(db);
  const jwt = await blogToken(env);
  const input = draftPost();
  const context = { waitUntil: () => undefined };
  const write = (authenticated: boolean, origin = "https://admin.gardendesk.ai", method = "PUT") =>
    worker.fetch(
      new Request("https://admin.gardendesk.ai/api/posts/first-post", {
        method,
        headers: {
          "content-type": "application/json",
          origin,
          ...(authenticated ? { "cf-access-jwt-assertion": jwt } : {}),
        },
        body: JSON.stringify(input),
      }),
      env,
      context,
    );
  const open = (path: string) =>
    worker.fetch(
      new Request(`https://gardendesk.ai${path}`, { headers: { "user-agent": "OAI-SearchBot" } }),
      env,
      context,
    );
  try {
    expect((await write(false)).status).toBe(403);
    expect((await write(true, "https://other.example")).status).toBe(403);
    expect((await write(true, undefined, "POST")).status).toBe(200);
    expect((await write(true, undefined, "POST")).status).toBe(409);
    expect((await open("/blog/first-post/")).status).toBe(404);
    expect(await (await open("/blog/feed.xml")).text()).not.toContain("first-post");
    input.publish = true;
    expect((await write(true)).status).toBe(200);
    await checkPublished(open, input.markdown);
    input.publish = false;
    expect((await write(true)).status).toBe(200);
    expect((await open("/blog/first-post/")).status).toBe(404);
    expect(await (await open("/sitemap.xml")).text()).not.toContain("first-post");
  } finally {
    db.close();
  }
});

test("the blog MCP endpoint needs the Access token and a matching origin", async () => {
  const db = new DatabaseSync(":memory:");
  const env = blogEnvironment(db);
  const jwt = await blogToken(env);
  const context = { waitUntil: () => undefined };
  const create = (headers: Record<string, string>) =>
    worker.fetch(
      new Request("https://admin.gardendesk.ai/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "create_post", arguments: { slug: "first-post", ...draftPost() } },
        }),
      }),
      env,
      context,
    );
  try {
    expect((await create({})).status).toBe(403);
    expect(
      (await create({ "cf-access-jwt-assertion": jwt, origin: "https://other.example" })).status,
    ).toBe(403);
    expect(await (await create({ "cf-access-jwt-assertion": jwt })).json()).toMatchObject({
      result: { content: [{ text: "Saved as a draft." }] },
    });
    const page = new Request("https://gardendesk.ai/blog/first-post/");
    expect((await worker.fetch(page, env, context)).status).toBe(404);
  } finally {
    db.close();
  }
});

function blogEnvironment(db: DatabaseSync): Env {
  db.exec(blogSchema);
  return {
    ASSETS: {
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/blog/") return new Response(template);
        if (path === "/sitemap.xml")
          return new Response("<urlset><url><loc>https://gardendesk.ai/</loc></url></urlset>");
        return new Response("Not found", { status: 404 });
      },
    },
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
    ACCESS_AUD: "blog",
    STATS: {
      prepare: (sql) => {
        let values: SQLInputValue[] = [];
        const statement = {
          bind: (...input: unknown[]) => {
            values = input as SQLInputValue[];
            return statement;
          },
          run: async () => db.prepare(sql).run(...values),
          all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
        };
        return statement;
      },
    },
  };
}

async function blogToken(env: Env): Promise<string> {
  const algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
  };
  const keys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "blog" };
  vi.stubGlobal("fetch", async () => Response.json({ keys: [jwk] }));
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", kid: "blog" })}.${encode({ aud: [env.ACCESS_AUD], exp: Date.now() / 1000 + 60, iss: env.ACCESS_TEAM_DOMAIN })}`;
  const signature = await crypto.subtle.sign(
    algorithm,
    keys.privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}

async function checkPublished(
  open: (path: string) => Promise<Response>,
  source: string,
): Promise<void> {
  const html = await (await open("/blog/first-post/")).text();
  expect(html).toContain("<h2>Useful heading</h2>");
  expect(html).toContain("<strong>Read this.</strong>");
  expect(html).toContain("Garden Desk team");
  expect(html).toContain('"@type":"BlogPosting"');
  expect(html).not.toContain("<script>alert");
  expect(html).not.toContain("javascript:");
  expect(await (await open("/sitemap.xml")).text()).toContain("/blog/first-post/");
  expect(await (await open("/blog/feed.xml")).text()).toContain("/blog/first-post/");
  expect(await (await open("/blog/first-post.md")).text()).toContain(source);
}

function draftPost() {
  return {
    title: "First <post>",
    description: "A useful description.",
    markdown:
      "## Useful heading\n\n**Read this.**\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))",
    publish: false,
  };
}
