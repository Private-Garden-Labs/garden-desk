import type { Env } from "./index";

export interface Post {
  slug: string;
  title: string;
  description: string;
  markdown: string;
  published_at: string | null;
  updated_at: string;
}

export async function posts(env: Env, drafts = false): Promise<Post[]> {
  const { results } = await env.STATS.prepare(
    `SELECT * FROM blog_posts ${drafts ? "" : "WHERE published_at IS NOT NULL"} ORDER BY ${drafts ? "updated_at" : "published_at"} DESC`,
  ).all<Post>();
  return results;
}

export async function post(env: Env, slug: string, drafts = false): Promise<Post | undefined> {
  const { results } = await env.STATS.prepare(
    `SELECT * FROM blog_posts WHERE slug = ?1 ${drafts ? "" : "AND published_at IS NOT NULL"}`,
  )
    .bind(slug)
    .all<Post>();
  return results[0];
}

export async function save(
  env: Env,
  slug: string,
  input: PostInput,
  create: boolean,
): Promise<boolean> {
  const now = new Date().toISOString();
  const conflict = create
    ? "DO NOTHING"
    : "DO UPDATE SET title = excluded.title, description = excluded.description, markdown = excluded.markdown, " +
      "published_at = CASE WHEN ?5 IS NULL THEN NULL ELSE COALESCE(blog_posts.published_at, ?5) END, updated_at = ?6";
  const { results } = await env.STATS.prepare(
    "INSERT INTO blog_posts (slug, title, description, markdown, published_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) " +
      `ON CONFLICT (slug) ${conflict} RETURNING slug`,
  )
    .bind(slug, input.title, input.description, input.markdown, input.publish ? now : null, now)
    .all<{ slug: string }>();
  return results.length > 0;
}

export interface PostInput {
  title: string;
  description: string;
  markdown: string;
  publish: boolean;
}

export function validInput(value: unknown): value is PostInput {
  if (value === null || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    boundedText(input.title, 180) &&
    boundedText(input.description, 320) &&
    boundedText(input.markdown, 100_000) &&
    typeof input.publish === "boolean"
  );
}

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}
