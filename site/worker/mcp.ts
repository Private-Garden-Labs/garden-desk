import { post, posts, save, validInput } from "./blog-store";
import type { Env } from "./index";
import { publicOrigin, responseHeaders } from "./page";

interface Message {
  id?: unknown;
  method?: string;
  params?: Record<string, unknown>;
}

const versions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const slugSchema = {
  type: "string",
  pattern: "^[a-z0-9]+(-[a-z0-9]+)*$",
  maxLength: 100,
  description: "URL name. The post lives at gardendesk.ai/blog/<slug>/.",
};
const postSchema = {
  type: "object",
  properties: {
    slug: slugSchema,
    title: { type: "string", maxLength: 180 },
    description: {
      type: "string",
      maxLength: 320,
      description: "One or two sentences for the post list, search results, and link previews.",
    },
    markdown: {
      type: "string",
      maxLength: 100_000,
      description: "The post body in GitHub Flavored Markdown, without the title.",
    },
    publish: {
      type: "boolean",
      description: "true shows the post on the website. false keeps it as a private draft.",
    },
  },
  required: ["slug", "title", "description", "markdown", "publish"],
};
const tools = [
  {
    name: "list_posts",
    description:
      "List every Garden Desk blog post, drafts included, most recently changed first. Drafts have published_at null.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_post",
    description: "Read one blog post, including its Markdown.",
    inputSchema: { type: "object", properties: { slug: slugSchema }, required: ["slug"] },
  },
  {
    name: "create_post",
    description: "Create a blog post. Fails when the URL name is already used.",
    inputSchema: postSchema,
  },
  {
    name: "update_post",
    description:
      "Replace the title, description, and Markdown of a blog post. Set publish to false to remove it from the website and keep it as a draft.",
    inputSchema: postSchema,
  },
];

export async function mcp(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  const message = (await request.json().catch(() => null)) as Message | null;
  if (typeof message !== "object" || message === null || Array.isArray(message))
    return reply(null, { error: { code: -32600, message: "Invalid request" } });
  if (message.id === undefined || message.method === undefined)
    return new Response(null, { status: 202 });
  return reply(message.id, await answer(env, message.method, message.params ?? {}));
}

async function answer(env: Env, method: string, params: Record<string, unknown>): Promise<object> {
  if (method === "initialize") {
    const requested = String(params.protocolVersion);
    return {
      result: {
        protocolVersion: versions.includes(requested) ? requested : versions[0],
        capabilities: { tools: {} },
        serverInfo: { name: "garden-desk-blog", version: "1.0.0" },
      },
    };
  }
  if (method === "ping") return { result: {} };
  if (method === "tools/list") return { result: { tools } };
  if (method !== "tools/call") return { error: { code: -32601, message: "Method not found" } };
  const tool = tools.find((entry) => entry.name === params.name);
  if (tool === undefined) return { error: { code: -32602, message: "Unknown tool" } };
  try {
    const text = await run(env, tool.name, (params.arguments ?? {}) as Record<string, unknown>);
    return { result: { content: [{ type: "text", text }] } };
  } catch (error) {
    return {
      result: { content: [{ type: "text", text: (error as Error).message }], isError: true },
    };
  }
}

async function run(env: Env, name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "list_posts")
    return JSON.stringify((await posts(env, true)).map(({ markdown, ...entry }) => entry));
  const slug = input.slug;
  if (typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))
    throw new Error("Use a URL name of lowercase letters, numbers, and single hyphens.");
  if (name === "get_post") {
    const entry = await post(env, slug, true);
    if (entry === undefined) throw new Error("No post uses this URL name.");
    return JSON.stringify(entry);
  }
  if (!validInput(input))
    throw new Error(
      "Give a title up to 180 characters, a description up to 320, Markdown up to 100,000, and publish as true or false.",
    );
  if (!(await save(env, slug, input, name === "create_post")))
    throw new Error("This URL name is already used. Choose another, or use update_post.");
  return input.publish ? `Published at ${publicOrigin}/blog/${slug}/` : "Saved as a draft.";
}

function reply(id: unknown, body: object): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, ...body }), {
    headers: responseHeaders("application/json; charset=utf-8", true),
  });
}
