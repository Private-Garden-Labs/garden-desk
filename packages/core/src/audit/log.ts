import { createHash } from "node:crypto";
import {
  type AuditEvent,
  type AuditEventInput,
  AuditEventInputSchema,
  AuditEventSchema,
} from "@gardendesk/shared";
import type { DatabasePort } from "../workspace/database.js";

type AuditValue = string | number | boolean | null;
interface AuditHead {
  sequence: number;
  hash: string;
}
const SENSITIVE_KEY = /body|content|document|password|prompt|secret|text|token/iu;

function safeMetadata(metadata: Record<string, AuditValue>): Record<string, AuditValue> {
  return Object.fromEntries(
    Object.entries(metadata)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : value]),
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
}

function eventHash(event: Omit<AuditEvent, "hash">): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(event)).digest("hex")}`;
}

export class AuditLog {
  constructor(private readonly database: DatabasePort) {}

  head(): AuditHead | undefined {
    return this.database
      .prepare("SELECT sequence, hash FROM audit_head WHERE singleton = 1")
      .get() as AuditHead | undefined;
  }

  private events(): AuditEvent[] {
    return this.parsed(
      this.database.prepare("SELECT event_json FROM audit_events ORDER BY sequence").all(),
    );
  }

  private tail(): AuditEvent | undefined {
    return this.parsed(
      this.database
        .prepare("SELECT event_json FROM audit_events ORDER BY sequence DESC LIMIT 1")
        .all(),
    )[0];
  }

  sessionEvents(sessionId: string): AuditEvent[] {
    return this.parsed(
      this.database
        .prepare(
          "SELECT event_json FROM audit_events WHERE json_extract(event_json, '$.metadata.sessionId') = ? ORDER BY sequence",
        )
        .all(sessionId),
    );
  }

  private parsed(rows: unknown[]): AuditEvent[] {
    return (rows as Array<{ event_json: string }>).map((row) =>
      AuditEventSchema.parse(JSON.parse(row.event_json)),
    );
  }

  append(input: AuditEventInput): AuditEvent {
    const parsed = AuditEventInputSchema.parse(input);
    return this.database.transaction(() => {
      const previous = this.tail();
      if (!this.matchesHead(previous)) throw new Error("audit_chain_invalid");
      const unsigned = {
        schemaVersion: 1 as const,
        sequence: (previous?.sequence ?? -1) + 1,
        timestamp: new Date().toISOString(),
        previousHash: previous?.hash ?? null,
        type: parsed.type,
        outcome: parsed.outcome,
        metadata: safeMetadata(parsed.metadata),
      };
      const event = AuditEventSchema.parse({ ...unsigned, hash: eventHash(unsigned) });
      this.database
        .prepare("INSERT INTO audit_events (sequence, event_json) VALUES (?, ?)")
        .run(event.sequence, JSON.stringify(event));
      this.database
        .prepare(
          "INSERT INTO audit_head VALUES (1, ?, ?) ON CONFLICT(singleton) DO UPDATE SET sequence = excluded.sequence, hash = excluded.hash",
        )
        .run(event.sequence, event.hash);
      return event;
    })();
  }

  private matchesHead(tail: AuditEvent | undefined): boolean {
    const head = this.head();
    if (tail === undefined) return head === undefined;
    const { hash, ...unsigned } = tail;
    return head?.sequence === tail.sequence && head.hash === hash && hash === eventHash(unsigned);
  }

  private validChain(events: AuditEvent[]): boolean {
    const chainIsValid = events.every((event, index) => {
      const { hash, ...unsigned } = event;
      return (
        unsigned.sequence === index &&
        hash === eventHash(unsigned) &&
        unsigned.previousHash === (events[index - 1]?.hash ?? null)
      );
    });
    return chainIsValid && this.matchesHead(events.at(-1));
  }

  verify(): boolean {
    try {
      return this.validChain(this.events());
    } catch {
      return false;
    }
  }
}
