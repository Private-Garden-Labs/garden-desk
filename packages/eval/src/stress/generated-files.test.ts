import { expect, it } from "vitest";
import { storyPdf } from "./generated-files.js";

it("does not read an embedded font program as PDF story text", () => {
  const font = `\0\x01BT (${"a".repeat(800)}) ET`;
  const pdf = `%PDF-1.4\n1 0 obj\n<< /Length1 900 >>\nstream\n${font}\nendstream\nendobj\n%%EOF\n`;
  expect(storyPdf(Buffer.from(pdf, "latin1")).content).toBe(false);
});
