import { type Post, post, posts } from "./blog-store";
import type { Env } from "./index";
import { markdown } from "./markdown";
import { escapeHtml, publicOrigin, publicPage, responseHeaders, time } from "./page";

export async function blog(request: Request, env: Env): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (path === "/sitemap.xml") return sitemap(request, env);
  if (!path.startsWith("/blog")) return undefined;
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405 });
  if (path === "/blog") return redirect("/blog/");
  if (path === "/blog/feed.xml") return feed(env);
  if (path === "/blog/") return index(env);
  return serveArticle(request, path, env);
}

async function serveArticle(request: Request, path: string, env: Env): Promise<Response> {
  const match = path.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/|\.md)?$/u);
  const entry = match?.[1] === undefined ? undefined : await post(env, match[1]);
  if (entry === undefined) return env.ASSETS.fetch(request);
  if (match?.[2] === ".md")
    return new Response(
      `# ${entry.title}\n\n${entry.description}\n\nBy Garden Desk team\n\n${entry.markdown}`,
      {
        headers: {
          ...responseHeaders("text/markdown; charset=utf-8"),
          link: `<${publicOrigin}/blog/${entry.slug}/>; rel="canonical"`,
        },
      },
    );
  if (match?.[2] === undefined) return redirect(`/blog/${entry.slug}/`);
  return article(env, entry);
}

async function index(env: Env): Promise<Response> {
  const entries = await posts(env);
  const cards =
    entries.length === 0
      ? "<section><p>The first post is on its way.</p></section>"
      : entries
          .map(
            (entry) =>
              `<section class="post-card"><p class="page-meta">${time(entry.published_at)}</p><h2><a href="/blog/${entry.slug}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.description)}</p></section>`,
          )
          .join("");
  return publicPage(env, {
    title: "Blog",
    description: "Notes and news from the Garden Desk team.",
    path: "/blog/",
    body: `<h1>From the Garden Desk team</h1><p class="lede">Notes, news, and useful ways to work with your files. Follow along with the <a href="/blog/feed.xml">RSS feed</a>.</p>${cards}`,
  });
}

function article(env: Env, entry: Post): Promise<Response> {
  const url = `${publicOrigin}/blog/${entry.slug}/`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: entry.title,
    description: entry.description,
    datePublished: entry.published_at,
    dateModified: entry.updated_at,
    mainEntityOfPage: url,
    url,
    image: `${publicOrigin}/assets/social-card.png`,
    author: { "@type": "Organization", name: "Garden Desk team", url: publicOrigin },
    publisher: { "@type": "Organization", name: "Garden Desk", url: publicOrigin },
  };
  return publicPage(env, {
    title: entry.title,
    description: entry.description,
    path: `/blog/${entry.slug}/`,
    schema,
    body: `<p class="page-meta">${time(entry.published_at)} · Garden Desk team</p><h1>${escapeHtml(entry.title)}</h1><p class="lede">${escapeHtml(entry.description)}</p><section class="prose">${markdown(entry.markdown)}</section><p class="post-links"><a href="/blog/">All posts</a><a href="/blog/${entry.slug}.md">Read as Markdown</a></p>`,
  });
}

async function feed(env: Env): Promise<Response> {
  const entries = await posts(env);
  const items = entries
    .map((entry) => {
      const url = `${publicOrigin}/blog/${entry.slug}/`;
      return `<item><title>${escapeHtml(entry.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeHtml(entry.description)}</description><pubDate>${new Date(entry.published_at ?? "").toUTCString()}</pubDate></item>`;
    })
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Garden Desk blog</title><link>${publicOrigin}/blog/</link><description>Notes and news from the Garden Desk team.</description><language>en</language>${items}</channel></rss>`,
    { headers: responseHeaders("application/rss+xml; charset=utf-8") },
  );
}

async function sitemap(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const staticMap = await response.text();
  const entries = await posts(env);
  const urls = entries
    .map(
      (entry) =>
        `<url><loc>${publicOrigin}/blog/${entry.slug}/</loc><lastmod>${entry.updated_at}</lastmod></url>`,
    )
    .join("");
  return new Response(staticMap.replace("</urlset>", `${urls}</urlset>`), {
    headers: responseHeaders("application/xml; charset=utf-8"),
  });
}

function redirect(path: string): Response {
  return new Response(null, { status: 301, headers: { location: path } });
}
