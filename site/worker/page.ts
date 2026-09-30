import type { Env } from "./index";

export const publicOrigin = "https://gardendesk.ai";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

interface PublicPage {
  title: string;
  description: string;
  path: string;
  body: string;
  schema?: object;
}

export async function publicPage(env: Env, options: PublicPage): Promise<Response> {
  const template = await (await env.ASSETS.fetch(new Request(`${publicOrigin}/blog/`))).text();
  const url = escapeHtml(`${publicOrigin}${options.path}`);
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const schema =
    options.schema === undefined
      ? ""
      : `<script type="application/ld+json">${JSON.stringify(options.schema).replace(/</gu, "\\u003c")}</script>`;
  const head = `<title>${title} | Garden Desk</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="Garden Desk blog" href="/blog/feed.xml">
<meta property="og:type" content="${options.schema === undefined ? "website" : "article"}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">${schema}`;
  const html = template
    .replace(/<!-- page -->[\s\S]*<!-- \/page -->/u, () => head)
    .replace(
      /<main([^>]*)><\/main>/u,
      (_, attributes: string) => `<main${attributes}>${options.body}</main>`,
    );
  return new Response(html, { headers: responseHeaders("text/html; charset=utf-8") });
}

interface AdminPage {
  title: string;
  section: "/stats/" | "/blog/";
  body: string;
  editor?: boolean;
}

export function adminPage(options: AdminPage): Response {
  const link = (path: string, label: string) =>
    `<a href="${path}"${path === options.section ? ' aria-current="page"' : ""}>${label}</a>`;
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)} | Garden Desk admin</title><link rel="icon" href="/assets/favicon.svg"><link rel="stylesheet" href="/assets/admin.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<header><a class="wordmark" href="/stats/"><img src="/assets/favicon.svg" alt="">Garden Desk admin</a><nav aria-label="Admin">${link("/stats/", "Analytics")}${link("/blog/", "Blog")}<a href="${publicOrigin}/">Website</a></nav></header>
<main id="main">${options.body}</main>${options.editor ? '<script type="module" src="/editor.js"></script>' : ""}</body></html>`,
    { headers: responseHeaders("text/html; charset=utf-8", true) },
  );
}

export function responseHeaders(type: string, privatePage = false): Record<string, string> {
  return {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...(privatePage ? { "x-robots-tag": "noindex, nofollow" } : {}),
  };
}
