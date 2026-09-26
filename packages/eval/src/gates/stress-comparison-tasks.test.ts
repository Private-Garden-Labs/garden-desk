import { expect, it } from "vitest";
import { stressTasks } from "./stress-comparison-tasks.js";

it("accepts spaced lists and thousands separators in specialist facts", () => {
  const [reconciliation] = stressTasks({ ids: ["reconciliation-partial"] });
  const [brief] = stressTasks({ ids: ["brief-board"] });
  const output = (text: string) => ({ text, bytes: Buffer.from(text), skills: [] });
  const paid = "fullyPaidIds: A, C; partialInvoiceId: B; balance 50; unpaid D; outstanding 125";
  const budget = "EUR 5,000; spent EUR 3,200; remaining EUR 1,800; Maya; 2026-09-30; 1 quote";
  expect(reconciliation?.check(output(paid)).facts).toBe(1);
  expect(brief?.check(output(budget)).facts).toBe(1);
});
