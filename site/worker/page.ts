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

const appearanceIcons = {
  system: "M4 5h16v12H4zM9 21h6M12 17v4",
  light:
    "M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  dark: "M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z",
};

export function adminPage(options: AdminPage): Response {
  const link = (path: string, label: string) =>
    `<a href="${path}"${path === options.section ? ' aria-current="page"' : ""}>${label}</a>`;
  const icons = Object.entries(appearanceIcons)
    .map(
      ([name, path]) =>
        `<svg class="icon-${name}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`,
    )
    .join("");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)} | Garden Desk admin</title><link rel="icon" href="/assets/favicon.svg"><script src="/appearance.js"></script><link rel="stylesheet" href="/assets/admin.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a>
<header><a class="wordmark" href="/stats/"><img src="/assets/favicon.svg" alt="">Garden Desk <span>Admin</span></a><nav aria-label="Admin">${link("/stats/", "Analytics")}${link("/blog/", "Blog")}<a href="${publicOrigin}/">Website</a></nav><button type="button" id="appearance" class="appearance" aria-label="Appearance: System. Switch to Light">${icons}</button></header>
<main id="main"${options.editor ? ' class="wide"' : ""}>${options.body}</main>${options.editor ? '<script type="module" src="/editor.js"></script>' : ""}</body></html>`,
    { headers: responseHeaders("text/html; charset=utf-8", true) },
  );
}

export function time(value: string | null): string {
  const label = new Date(value ?? "").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `<time datetime="${value}">${label}</time>`;
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
