import appearance from "./admin-appearance.txt";
import client from "./admin-client.txt";
import { type Post, type PostInput, post, posts, save, validInput } from "./blog-store";
import type { Env } from "./index";
import { markdown } from "./markdown";
import { adminPage, escapeHtml, publicOrigin, responseHeaders, time } from "./page";

const scripts: Record<string, string> = { "/editor.js": client, "/appearance.js": appearance };

export async function admin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname);
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405 });
  const script = scripts[url.pathname];
  if (script !== undefined)
    return new Response(script, {
      headers: responseHeaders("text/javascript; charset=utf-8", true),
    });
  if (url.pathname === "/")
    return new Response(null, { status: 302, headers: { location: "/stats/" } });
  if (url.pathname === "/blog/") return list(env);
  if (url.pathname === "/new/") return editor();
  const slug = url.pathname.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u)?.[1];
  const entry = slug === undefined ? undefined : await post(env, slug, true);
  return entry === undefined ? new Response("Not found", { status: 404 }) : editor(entry);
}

async function api(request: Request, env: Env, path: string): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Forbidden" }, 403);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (path === "/api/preview" && request.method === "POST") return preview(input);
  const slug = path.match(/^\/api\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u)?.[1];
  if (
    slug === undefined ||
    slug.length > 100 ||
    (request.method !== "PUT" && request.method !== "POST")
  )
    return json({ error: "Invalid post address" }, 400);
  if (!validInput(input))
    return json(
      { error: "Enter a title, description, and post. Maximum post length is 100,000 characters." },
      400,
    );
  if (!(await save(env, slug, input, request.method === "POST")))
    return json({ error: "This URL name is already used. Choose another name." }, 409);
  return json({ url: `/blog/${slug}/` });
}

function preview(input: unknown): Response {
  const source = (input as Partial<PostInput> | null)?.markdown;
  if (typeof source !== "string" || source.length > 100_000)
    return json({ error: "Maximum post length is 100,000 characters." }, 400);
  return json({ html: markdown(source) });
}

async function list(env: Env): Promise<Response> {
  const entries = await posts(env, true);
  const rows = entries
    .map(
      (entry) =>
        `<li><a href="/blog/${entry.slug}/"><span class="title">${escapeHtml(entry.title)}</span><span class="meta">${entry.published_at === null ? "Draft" : '<span class="published">Published</span>'} · Updated ${time(entry.updated_at)}</span></a></li>`,
    )
    .join("");
  return adminPage({
    title: "Blog posts",
    section: "/blog/",
    body: `<div class="page-heading"><h1>Blog posts</h1><a class="button" href="/new/">New post</a></div>${entries.length === 0 ? '<p class="empty">No posts yet. Write a draft, preview it, then publish it on the website.</p>' : `<ul class="post-list">${rows}</ul>`}`,
  });
}

function editor(entry?: Post): Response {
  const published = entry?.published_at != null;
  const fields = entry ?? { slug: "", title: "", description: "", markdown: "" };
  const status =
    entry === undefined
      ? "New draft. Only you can see it."
      : published
        ? `Published on the website. <a href="${publicOrigin}/blog/${fields.slug}/">View post</a>`
        : "Draft. Only you can see it.";
  const actions = published
    ? '<button type="submit" value="unpublish" class="danger">Remove from website</button><button type="submit" value="save">Save changes</button>'
    : '<button type="submit" value="save" class="secondary">Save draft</button><button type="submit" value="publish">Publish</button>';
  return adminPage({
    title: entry === undefined ? "New post" : fields.title,
    section: "/blog/",
    editor: true,
    body: `<form id="post-form" data-published="${published}" data-existing="${entry !== undefined}">
<div class="editor-bar"><div><h1>${entry === undefined ? "New post" : "Edit post"}</h1><p class="meta">${status}</p></div><div class="actions"><p id="save-status" role="status" aria-live="polite"></p>${actions}</div></div>
<div class="editor-grid"><div class="fields">
<label>Title<input name="title" required maxlength="180" value="${escapeHtml(fields.title)}"></label>
<label>URL name<span class="slug"><span>gardendesk.ai/blog/</span><input name="slug" required maxlength="100" pattern="[a-z0-9]+(-[a-z0-9]+)*" ${entry === undefined ? "" : "readonly"} value="${escapeHtml(fields.slug)}" aria-describedby="slug-help"></span></label>
<p id="slug-help" class="hint">Lowercase letters, numbers, and hyphens. It cannot change after the first save.</p>
<label>Description<textarea name="description" required maxlength="320" rows="2">${escapeHtml(fields.description)}</textarea></label>
<label class="markdown">Markdown<textarea name="markdown" required maxlength="100000" spellcheck="true">${escapeHtml(fields.markdown)}</textarea></label>
</div><section class="preview" aria-label="Preview"><h2 id="preview-title">${escapeHtml(fields.title)}</h2><p id="preview-description" class="lede">${escapeHtml(fields.description)}</p><div id="preview" class="prose">${markdown(fields.markdown)}</div></section></div>
</form>`,
  });
}

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders("application/json; charset=utf-8", true),
  });
}
