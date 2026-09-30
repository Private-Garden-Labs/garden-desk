import type { Env } from "./index";
import { page } from "./page";

interface Row {
  day: string;
  kind: string;
  platform: string;
  count: number;
}

export async function stats(env: Env): Promise<Response> {
  const since = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);
  const { results } = await env.STATS.prepare(
    "SELECT day, kind, platform, count FROM daily_counts WHERE day >= ?1 ORDER BY day DESC",
  )
    .bind(since)
    .all<Row>();
  return page({
    title: "Analytics",
    description: "Garden Desk website analytics.",
    path: "/stats/",
    admin: true,
    body: `<h1>Analytics</h1><p>Last 90 days. Dates use UTC. Page loads and download starts can include repeat visits.</p>${table(
      "Page loads",
      results.filter((row) => row.kind === "visit"),
    )}${table(
      "Download starts",
      results.filter((row) => row.kind === "download"),
    )}`,
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
  const lines = days.map(
    (day) =>
      `<tr><td>${day}</td><td>${total(day)}</td>${platforms
        .map((platform) => `<td>${cell(day, platform)}</td>`)
        .join("")}</tr>`,
  );
  const sums = platforms.map((platform) =>
    rows.filter((row) => row.platform === platform).reduce((sum, row) => sum + row.count, 0),
  );
  return `<h2>${title}</h2><div class="table-scroll"><table><thead><tr><th>Day</th><th>Total</th>${platforms
    .map((platform) => `<th>${platform}</th>`)
    .join(
      "",
    )}</tr></thead><tbody>${lines.join("")}</tbody><tfoot><tr><td>90 days</td><td>${sums.reduce((a, b) => a + b, 0)}</td>${sums
    .map((sum) => `<td>${sum}</td>`)
    .join("")}</tr></tfoot></table></div>`;
}
