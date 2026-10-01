import { isOwner } from "./access";
import { admin } from "./admin";
import { blog } from "./blog";
import { stats } from "./stats";

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
    if (url.hostname === "admin.gardendesk.ai") return serveAdmin(request, env);
    return servePage(request, env, context, await blog(request, env));
  },
};

async function serveAdmin(request: Request, env: Env): Promise<Response> {
  if (!(await isOwner(request, env))) return new Response("Forbidden", { status: 403 });
  return new URL(request.url).pathname === "/stats/" ? stats(env) : admin(request, env);
}

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

async function servePage(
  request: Request,
  env: Env,
  context: Context,
  served?: Response,
): Promise<Response> {
  const response = served ?? (await env.ASSETS.fetch(request));
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
