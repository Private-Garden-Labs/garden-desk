export const publicOrigin = "https://gardendesk.ai";
export const adminOrigin = "https://admin.gardendesk.ai";

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

interface Page {
  title: string;
  description: string;
  path: string;
  body: string;
  admin?: boolean;
  editor?: boolean;
  schema?: object;
}

export function page(options: Page): Response {
  const origin = options.admin ? adminOrigin : publicOrigin;
  const canonical = `${origin}${options.path}`;
  const schema =
    options.schema === undefined
      ? ""
      : `<script type="application/ld+json">${JSON.stringify(options.schema).replace(/</gu, "\\u003c")}</script>`;
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)} | Garden Desk</title>
<meta name="description" content="${escapeHtml(options.description)}">
<meta name="robots" content="${options.admin ? "noindex,nofollow" : "index,follow,max-image-preview:large"}">
<link rel="canonical" href="${escapeHtml(canonical)}"><link rel="icon" href="/assets/favicon.svg">
${options.admin ? "" : '<link rel="stylesheet" href="/assets/motion.css">'}<link rel="stylesheet" href="/assets/blog.css">
<link rel="alternate" type="application/rss+xml" title="Garden Desk blog" href="${publicOrigin}/blog/feed.xml">
<meta property="og:type" content="${options.schema ? "article" : "website"}">
<meta property="og:title" content="${escapeHtml(options.title)}"><meta property="og:description" content="${escapeHtml(options.description)}">
<meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:site_name" content="Garden Desk">
<meta property="og:image" content="${publicOrigin}/assets/social-card.png">
<meta name="twitter:card" content="summary_large_image">${schema}`;
  return new Response(
    `<!doctype html><html lang="en"><head>${head}</head><body>
<a class="skip-link" href="#main">Skip to content</a>${navigation(options.admin === true)}
<main id="main">${options.body}</main>${footer(options.admin === true)}
${options.editor ? '<script type="module" src="/editor.js"></script>' : ""}</body></html>`,
    {
      headers: responseHeaders("text/html; charset=utf-8", options.admin === true),
    },
  );
}

function navigation(admin: boolean): string {
  const links = admin
    ? '<a href="/stats/">Analytics</a><a href="/blog/">Blog</a>'
    : '<a href="/">Home</a><a href="/blog/">Blog</a><a href="/releases/">Releases</a>';
  return `<header><a class="wordmark" href="${admin ? "/" : publicOrigin}"><img src="/assets/favicon.svg" alt="">Garden Desk${admin ? " admin" : ""}</a><nav aria-label="Main navigation">${links}</nav></header>`;
}

function footer(admin: boolean): string {
  return `<footer><span>Garden Desk ${admin ? "admin" : "team"}</span><nav aria-label="Footer"><a href="${publicOrigin}/privacy/">Privacy</a><a href="${publicOrigin}/security/">Security</a>${admin ? `<a href="${publicOrigin}/">Website</a>` : '<a href="/blog/feed.xml">RSS feed</a>'}</nav></footer>`;
}

export function responseHeaders(type: string, privatePage = false): Record<string, string> {
  return {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    ...(privatePage ? { "x-robots-tag": "noindex, nofollow" } : {}),
  };
}
