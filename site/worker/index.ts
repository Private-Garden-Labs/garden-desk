interface Statement {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  STATS: { prepare(sql: string): Statement };
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

interface Row {
  day: string;
  kind: string;
  platform: string;
  count: number;
}

const bot = /bot|crawl|spider|slurp|preview|curl|wget|python|headless|lighthouse|monitor/iu;
const download = /\/Garden-Desk-[^/]+-([a-z]+-[a-z0-9_]+)\.[a-z]+$/u;

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "www.gardendesk.ai") {
      url.hostname = "gardendesk.ai";
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === "downloads.gardendesk.ai")
      return serveDownload(request, url, env, context);
    if (url.pathname.startsWith("/admin/")) {
      const allowed = url.pathname === "/admin/stats" && (await isOwner(request, env));
      return allowed ? stats(env) : new Response("Forbidden", { status: 403 });
    }
    return servePage(request, env, context);
  },
};

function counted(request: Request): boolean {
  return request.method === "GET" && !bot.test(request.headers.get("user-agent") ?? "");
}

async function serveDownload(
  request: Request,
  url: URL,
  env: Env,
  context: Context,
): Promise<Response> {
  const response = await fetch(request);
  const platform = url.pathname.match(download)?.[1];
  const whole =
    response.status === 200 ||
    (response.status === 206 && /^bytes=0-/u.test(request.headers.get("range") ?? ""));
  if (counted(request) && whole && platform !== undefined) {
    context.waitUntil(count(env, "download", platform));
  }
  return response;
}

async function servePage(request: Request, env: Env, context: Context): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const page = response.headers.get("content-type")?.startsWith("text/html") === true;
  const framed = request.headers.get("sec-fetch-dest") === "iframe";
  if (counted(request) && page && !framed && response.status === 200) {
    context.waitUntil(
      count(env, "visit", visitorPlatform(request.headers.get("user-agent") ?? "")),
    );
  }
  return response;
}

function visitorPlatform(agent: string): string {
  if (/iPhone|iPad/u.test(agent)) return "iOS";
  if (/Android/u.test(agent)) return "Android";
  if (/Windows/u.test(agent)) return "Windows";
  if (/Macintosh/u.test(agent)) return "macOS";
  if (/Linux|X11|CrOS/u.test(agent)) return "Linux";
  return "Other";
}

function count(env: Env, kind: string, platform: string): Promise<unknown> {
  return env.STATS.prepare(
    "INSERT INTO daily_counts (day, kind, platform, count) VALUES (?1, ?2, ?3, 1) " +
      "ON CONFLICT (day, kind, platform) DO UPDATE SET count = count + 1",
  )
    .bind(new Date().toISOString().slice(0, 10), kind, platform)
    .run();
}

async function isOwner(request: Request, env: Env): Promise<boolean> {
  const [header, payload, signature] = (request.headers.get("cf-access-jwt-assertion") ?? "").split(
    ".",
  );
  if (header === undefined || payload === undefined || signature === undefined) return false;
  try {
    const { kid } = JSON.parse(text(header)) as { kid?: string };
    const claims = JSON.parse(text(payload)) as {
      aud?: string | string[];
      exp?: number;
      iss?: string;
    };
    const certs = await fetch(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    const { keys } = (await certs.json()) as { keys: (JsonWebKey & { kid: string })[] };
    const jwk = keys.find((key) => key.kid === kid);
    if (jwk === undefined) return false;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const signed = new TextEncoder().encode(`${header}.${payload}`);
    return (
      (await crypto.subtle.verify(algorithm, key, bytes(signature), signed)) &&
      claims.iss === env.ACCESS_TEAM_DOMAIN &&
      [claims.aud].flat().includes(env.ACCESS_AUD) &&
      (claims.exp ?? 0) > Date.now() / 1000
    );
  } catch {
    return false;
  }
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64url.replace(/-/gu, "+").replace(/_/gu, "/")), (c) =>
    c.charCodeAt(0),
  );
}

function text(base64url: string): string {
  return new TextDecoder().decode(bytes(base64url));
}

async function stats(env: Env): Promise<Response> {
  const since = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
  const { results } = await env.STATS.prepare(
    "SELECT day, kind, platform, count FROM daily_counts WHERE day >= ?1 ORDER BY day DESC",
  )
    .bind(since)
    .all<Row>();
  const body = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Garden Desk stats</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:60rem;padding:0 1rem;color:#1d2a22}
table{border-collapse:collapse;width:100%;margin-bottom:2.5rem}
th,td{padding:.35rem .6rem;text-align:right;border-bottom:1px solid #e3e8e4}
th:first-child,td:first-child{text-align:left}
tfoot td{font-weight:600}
.bar{display:inline-block;height:.6rem;background:#4f8a5f;border-radius:2px;margin-right:.5rem;vertical-align:middle}
</style>
<h1>Garden Desk stats</h1>
<p>Last 90 days. Days are in UTC. A visit is one full page load. A download is one started file download.</p>
${table(
  "Visits",
  results.filter((row) => row.kind === "visit"),
)}
${table(
  "Downloads",
  results.filter((row) => row.kind === "download"),
)}
</html>`;
  return new Response(body, {
    headers: { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" },
  });
}

function table(title: string, rows: Row[]): string {
  const platforms = [...new Set(rows.map((row) => row.platform))].sort((a, b) =>
    a.localeCompare(b),
  );
  const days = [...new Set(rows.map((row) => row.day))];
  const cell = (day: string, platform: string) =>
    rows.find((row) => row.day === day && row.platform === platform)?.count ?? 0;
  const total = (day: string) => platforms.reduce((sum, platform) => sum + cell(day, platform), 0);
  const most = Math.max(1, ...days.map(total));
  const lines = days.map(
    (day) =>
      `<tr><td>${day}</td><td><span class="bar" style="width:${(total(day) / most) * 8}rem"></span>${total(day)}</td>${platforms
        .map((platform) => `<td>${cell(day, platform)}</td>`)
        .join("")}</tr>`,
  );
  const sums = platforms.map((platform) =>
    rows.filter((row) => row.platform === platform).reduce((sum, row) => sum + row.count, 0),
  );
  return `<h2>${title}</h2><table><thead><tr><th>Day</th><th>Total</th>${platforms
    .map((platform) => `<th>${platform}</th>`)
    .join(
      "",
    )}</tr></thead><tbody>${lines.join("")}</tbody><tfoot><tr><td>90 days</td><td>${sums.reduce((a, b) => a + b, 0)}</td>${sums
    .map((sum) => `<td>${sum}</td>`)
    .join("")}</tr></tfoot></table>`;
}
