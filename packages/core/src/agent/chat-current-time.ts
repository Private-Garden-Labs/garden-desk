import type { ChatMessage } from "@gardendesk/shared";

function localIsoTimestamp(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName?.slice(3);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}${offset}`;
}

export function currentTimeContext(
  guidance: string,
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  return [
    "Current host date and time:",
    `- Local: ${localIsoTimestamp(now, timeZone)} [${timeZone}]`,
    `- UTC: ${now.toISOString()}`,
    guidance,
  ].join("\n");
}

export function withCurrentTimeContext(
  messages: readonly ChatMessage[],
  clock: string,
): ChatMessage[] {
  const first = messages[0];
  if (first?.role !== "system") throw new Error("agent_system_prompt_missing");
  return [{ role: "system", text: `${first.text}\n\n${clock}` }, ...messages.slice(1)];
}
