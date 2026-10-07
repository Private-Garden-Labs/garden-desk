import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { dimensions } from "./database.js";

const chunkCharacters = 1_500;
const batchSize = 32;

interface Encoder {
  server: ChildProcess;
  url: string;
}

function splitLong(paragraph: string): string[] {
  const pieces: string[] = [];
  let rest = paragraph;
  while (rest.length > chunkCharacters) {
    const cut = rest.lastIndexOf(" ", chunkCharacters);
    const end = cut > 0 ? cut : chunkCharacters;
    pieces.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  return [...pieces, rest];
}

/** Chunks of at most 1,500 characters, split at paragraph boundaries where possible. */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split("\n").flatMap(splitLong)) {
    if (current !== "" && current.length + 1 + paragraph.length > chunkCharacters) {
      chunks.push(current);
      current = "";
    }
    current = current === "" ? paragraph : `${current}\n${paragraph}`;
  }
  return current === "" ? chunks : [...chunks, current];
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  await new Promise<void>((accept) => server.close(() => accept()));
  if (address === null || typeof address === "string") throw new Error("No free port.");
  return address.port;
}

async function startEncoder(serverPath: string, modelPath: string): Promise<Encoder> {
  const port = await freePort();
  const server = spawn(
    serverPath,
    [
      ...["--model", modelPath, "--offline", "--embedding", "--pooling", "last"],
      ...["--ctx-size", "8192", "--batch-size", "2048", "--ubatch-size", "2048"],
      ...["--parallel", "4", "--host", "127.0.0.1", "--port", String(port)],
    ],
    { stdio: "ignore" },
  );
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`llama-server exited (${server.exitCode}).`);
    const ready = await fetch(`${url}/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) return { server, url };
    await delay(500);
  }
  server.kill();
  throw new Error("llama-server did not become ready.");
}

function vectorBlob(values: number[]): Uint8Array {
  if (values.length !== dimensions) throw new Error(`Expected ${dimensions} dimensions.`);
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  const view = new DataView(new ArrayBuffer(dimensions * 4));
  for (const [index, value] of values.entries()) view.setFloat32(index * 4, value / norm, true);
  return new Uint8Array(view.buffer);
}

async function embed(encoder: Encoder, inputs: string[]): Promise<Uint8Array[]> {
  const response = await fetch(`${encoder.url}/v1/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: inputs, encoding_format: "float", truncate: false }),
  });
  if (!response.ok)
    throw new Error(`Embedding failed (${response.status}): ${await response.text()}`);
  const body = (await response.json()) as { data: Array<{ index: number; embedding: number[] }> };
  if (body.data.length !== inputs.length) throw new Error("Embedding count does not match input.");
  return body.data
    .sort((left, right) => left.index - right.index)
    .map((row) => vectorBlob(row.embedding));
}

function pendingChunks(database: DatabaseSync): Array<{ sectionId: number; input: string }> {
  const rows = database
    .prepare("SELECT id, citation, heading, text FROM sections ORDER BY id")
    .all();
  return rows.flatMap((row) =>
    chunkText(String(row.text)).map((chunk) => ({
      sectionId: Number(row.id),
      input: `${row.citation} ${row.heading}\n${chunk}`,
    })),
  );
}

/** Fills `chunks` with L2-normalized float32 vectors from the managed encoder. */
export async function writeVectors(database: DatabaseSync, serverPath: string, modelPath: string) {
  const chunks = pendingChunks(database);
  const encoder = await startEncoder(serverPath, modelPath);
  const insert = database.prepare("INSERT INTO chunks (section_id, vector) VALUES (?, ?)");
  database.exec("BEGIN");
  try {
    for (let start = 0; start < chunks.length; start += batchSize) {
      const batch = chunks.slice(start, start + batchSize);
      const vectors = await embed(
        encoder,
        batch.map((chunk) => chunk.input),
      );
      for (const [index, chunk] of batch.entries()) {
        insert.run(chunk.sectionId, vectors[index] as Uint8Array);
      }
      if ((start / batchSize) % 100 === 0) console.log(`vectors ${start}/${chunks.length}`);
    }
    database.exec("COMMIT");
  } finally {
    encoder.server.kill();
  }
  console.log(`vectors ${chunks.length}/${chunks.length}`);
}
