import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Windows release starts without a console", () => {
  const executable = readFileSync(
    new URL("src-tauri/target/release/bundle/windows/Garden Desk/Garden Desk.exe", import.meta.url),
  );
  const peOffset = executable.readUInt32LE(0x3c);
  assert.equal(executable.readUInt16LE(peOffset + 24 + 68), 2);
});
