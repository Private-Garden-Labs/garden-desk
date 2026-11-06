import type { Env } from "./index";
import { adminPage, escapeHtml, time } from "./page";

interface Key {
  key: string;
  customer: string;
  created_at: string;
  revoked_at: string | null;
  uses: number;
  last_used_at: string | null;
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function createKey(env: Env, customer: string): Promise<string> {
  const characters = [...crypto.getRandomValues(new Uint8Array(20))].map(
    (byte) => alphabet[byte % alphabet.length],
  );
  const key = `GD-${[0, 5, 10, 15].map((start) => characters.slice(start, start + 5).join("")).join("-")}`;
  await env.PACK_KEYS.prepare("INSERT INTO keys (key, customer, created_at) VALUES (?1, ?2, ?3)")
    .bind(key, customer, new Date().toISOString())
    .run();
  return key;
}

export async function deleteUnusedKey(env: Env, key: string): Promise<boolean> {
  const { results } = await env.PACK_KEYS.prepare(
    "DELETE FROM keys WHERE key = ?1 AND uses = 0 RETURNING key",
  )
    .bind(key)
    .all();
  return results.length > 0;
}

export async function keysPage(env: Env): Promise<Response> {
  const { results } = await env.PACK_KEYS.prepare(
    "SELECT key, customer, created_at, revoked_at, uses, last_used_at FROM keys ORDER BY created_at DESC",
  ).all<Key>();
  const rows = results
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.customer)}${row.revoked_at === null ? "" : ' <span class="meta">Revoked</span>'}</td><td><code class="key">${row.key}</code></td><td>${time(row.created_at)}</td><td align="right">${row.uses}</td><td>${row.last_used_at === null ? "Never" : time(row.last_used_at)}</td><td>${row.uses === 0 ? `<button type="button" class="danger" data-key="${row.key}" aria-label="Delete ${row.key}">Delete</button>` : ""}</td></tr>`,
    )
    .join("");
  return adminPage({
    title: "Data pack keys",
    section: "/keys/",
    script: "/keys.js",
    body: `<h1>Data pack keys</h1><p class="meta">A key unlocks the paid data packs. Downloads counts every pack download with the key, including updates. You can delete a key until its first download.</p>
<form id="new-key" class="new-key"><label>Customer<input name="customer" required maxlength="200" autocomplete="off"></label><button type="submit">Create key</button></form>
<p id="key-status" class="hint" role="status" aria-live="polite"></p>
${results.length === 0 ? '<p class="empty">No keys yet.</p>' : `<div class="table-scroll"><table class="keys"><thead><tr><th>Customer</th><th>Key</th><th>Created</th><th align="right">Downloads</th><th>Last download</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`}`,
  });
}
