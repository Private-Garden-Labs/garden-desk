export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The desktop bridge returned an invalid response.");
  }
  return value as Record<string, unknown>;
}
