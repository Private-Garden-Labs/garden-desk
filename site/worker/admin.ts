import client from "./admin-client.txt";
import { type Post, post, posts, save, validInput } from "./blog-store";
import type { Env } from "./index";
import { markdown } from "./markdown";
import { adminOrigin, escapeHtml, page, publicOrigin, responseHeaders } from "./page";

export async function admin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname);
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405 });
  if (url.pathname === "/editor.js")
    return new Response(client, {
      headers: responseHeaders("text/javascript; charset=utf-8", true),
    });
  if (url.pathname.startsWith("/assets/")) return env.ASSETS.fetch(request);
  if (url.pathname === "/") return Response.redirect(`${adminOrigin}/stats/`, 302);
  if (url.pathname === "/blog/") return list(env);
  if (url.pathname === "/new/") return editor();
  const slug = url.pathname.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u)?.[1];
  const entry = slug === undefined ? undefined : await post(env, slug, true);
  return entry === undefined ? new Response("Not found", { status: 404 }) : editor(entry);
}

async function api(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method !== "PUT" && request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Use JSON" }, 415);
  let input: unknown;
  try {
    input = JSON.parse(await boundedBody(request));
  } catch {
    return json({ error: "Invalid or too large post" }, 400);
  }
  if (!validInput(input))
    return json(
      { error: "Enter a title, description, and post. Maximum post length is 100,000 characters." },
      400,
    );
  if (path === "/api/preview" && request.method === "POST")
    return json({ html: markdown(input.markdown) });
  return writePost(request, env, path, input);
}

async function writePost(
  request: Request,
  env: Env,
  path: string,
  input: import("./blog-store").PostInput,
): Promise<Response> {
  const slug = path.match(/^\/api\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u)?.[1];
  if (slug === undefined || slug.length > 100) return json({ error: "Invalid post address" }, 400);
  if (!(await save(env, slug, input, request.method === "POST")))
    return json({ error: "This URL name is already used. Choose another name." }, 409);
  return json({ url: `/blog/${slug}/`, published: input.publish });
}

async function boundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (reader === undefined) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return body + decoder.decode();
    size += chunk.value.byteLength;
    if (size > 500_000) {
      await reader.cancel();
      throw new Error("Post too large");
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
}

async function list(env: Env): Promise<Response> {
  const entries = await posts(env, true);
  const rows = entries
    .map(
      (entry) =>
        `<tr><td><a href="/blog/${entry.slug}/">${escapeHtml(entry.title)}</a></td><td>${entry.published_at === null ? "Draft" : "Published"}</td><td>${escapeHtml(entry.updated_at.slice(0, 10))}</td></tr>`,
    )
    .join("");
  return page({
    title: "Blog posts",
    description: "Manage Garden Desk blog posts.",
    path: "/blog/",
    admin: true,
    body: `<div class="page-heading"><h1>Blog posts</h1><a class="button" href="/new/">New post</a></div><p>Write a draft, preview it, then publish it on the website.</p>${entries.length === 0 ? "<p>No posts yet.</p>" : `<div class="table-scroll"><table><thead><tr><th>Post</th><th>Status</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table></div>`}`,
  });
}

function editor(entry?: Post): Response {
  const published = entry?.published_at != null;
  const existing = entry !== undefined;
  const fields = entry ?? { slug: "", title: "", description: "", markdown: "" };
  const title = existing ? "Edit post" : "New post";
  return page({
    title,
    description: "Write a Garden Desk blog post.",
    path: existing ? `/blog/${fields.slug}/` : "/new/",
    admin: true,
    editor: true,
    body: `<a href="/blog/">All posts</a><h1>${title}</h1><p>Every post is from the Garden Desk team.</p>
<form id="post-form" data-published="${published}" data-existing="${existing}">
<label>Title<input name="title" required maxlength="180" value="${escapeHtml(fields.title)}"></label>
<label>URL name<input name="slug" required maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" ${existing ? "readonly" : ""} value="${escapeHtml(fields.slug)}" aria-describedby="slug-help"></label><p id="slug-help" class="meta">Lowercase letters, numbers, and hyphens. The address stays fixed after the first save.</p>
<label>Description<textarea name="description" required maxlength="320" rows="2">${escapeHtml(fields.description)}</textarea></label>
<div class="editor-grid"><label>Markdown<textarea name="markdown" required maxlength="100000" rows="22" spellcheck="true">${escapeHtml(fields.markdown)}</textarea></label><section aria-label="Post preview"><h2>Preview</h2><div id="preview" class="prose">${existing ? markdown(fields.markdown) : "<p>Your preview will appear here.</p>"}</div></section></div>
<div class="actions"><button type="submit" value="save">${published ? "Save changes" : "Save draft"}</button>${published ? "" : '<button type="submit" value="publish">Publish</button>'}${published ? '<button type="submit" value="unpublish" class="secondary">Remove from website</button>' : ""}<button type="button" id="preview-button" class="secondary">Refresh preview</button>${published ? `<a href="${publicOrigin}/blog/${fields.slug}/">View public post</a>` : ""}</div>
<p id="save-status" role="status" aria-live="polite"></p></form>`,
  });
}

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders("application/json; charset=utf-8", true),
  });
}
