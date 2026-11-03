import { createPublicKey, type KeyObject, verify } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { createInflateRaw } from "node:zlib";
import {
  type DataPack,
  DataPackSchema,
  type DataPackStatus,
  type DataPacks,
  LAW_PACK_DIRECTORIES,
} from "@gardendesk/shared";
import { digest } from "../runtime/models.js";

const STORE = "https://packs.gardendesk.ai/v1";
export const DATA_PACK_SIGNING_KEY = createPublicKey({
  key: Buffer.from("MCowBQYDK2VwAyEAmJql8mYvtEccvLlKSSIEX5AZD/lWxTu0ajgoTKfzWCs=", "base64"),
  format: "der",
  type: "spki",
});
const STORE_TIMEOUT_MS = 2_500;

type Failure = NonNullable<DataPackStatus["failure"]>;

export interface DataPackInstall {
  pack: DataPack;
  failure?: Failure;
}

function authorization(key: string | undefined): Record<string, string> {
  return key === undefined ? {} : { authorization: `Bearer ${key}` };
}

function failureOf(error: unknown): Failure {
  const message = error instanceof Error ? error.message : "";
  return message === "key" || message === "invalid" ? message : "unavailable";
}

async function extract(archive: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const file = await open(archive);
  try {
    const { size } = await file.stat();
    const tail = Buffer.alloc(Math.min(size, 65_557));
    await file.read(tail, 0, tail.length, size - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error("invalid");
    let offset = tail.readUInt32LE(end + 16);
    for (let index = tail.readUInt16LE(end + 10); index > 0; index -= 1) {
      const entry = Buffer.alloc(46);
      await file.read(entry, 0, entry.length, offset);
      const nameLength = entry.readUInt16LE(28);
      const name = Buffer.alloc(nameLength);
      await file.read(name, 0, nameLength, offset + 46);
      const local = Buffer.alloc(30);
      const localOffset = entry.readUInt32LE(42);
      await file.read(local, 0, local.length, localOffset);
      const start = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      await pipeline(
        createReadStream(archive, { start, end: start + entry.readUInt32LE(20) - 1 }),
        entry.readUInt16LE(10) === 8 ? createInflateRaw() : new PassThrough(),
        createWriteStream(join(destination, basename(name.toString("utf8")))),
      );
      offset += 46 + nameLength + entry.readUInt16LE(30) + entry.readUInt16LE(32);
    }
  } finally {
    await file.close();
  }
}

export class DataPackStore {
  private readonly downloading = new Set<string>();
  private readonly failures = new Map<string, Failure>();

  constructor(
    private readonly root: string,
    private readonly signingKey: KeyObject,
    private readonly release: (pack: DataPack) => void,
    private readonly finished: (result: DataPackInstall) => void,
  ) {}

  async list(): Promise<DataPacks> {
    const [installed, catalog, key] = await Promise.all([
      this.installedPacks(),
      this.catalog().catch(() => undefined),
      this.key(),
    ]);
    const known = catalog ?? [];
    const packs = [
      ...known,
      ...installed.filter((pack) => !known.some((item) => item.id === pack.id)),
    ];
    return {
      keySaved: key !== undefined,
      online: catalog !== undefined,
      packs: packs.map((pack) =>
        this.status(
          pack,
          installed.find((item) => item.id === pack.id),
        ),
      ),
    };
  }

  async saveKey(key: string): Promise<boolean> {
    const response = await fetch(`${STORE}/key`, {
      headers: authorization(key),
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
    });
    if (response.status !== 204) return false;
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, "key"), key);
    this.failures.clear();
    return true;
  }

  async install(id: string): Promise<boolean> {
    const pack = (await this.catalog()).find((item) => item.id === id);
    if (pack === undefined || this.downloading.has(id)) return false;
    this.downloading.add(id);
    this.failures.delete(id);
    void this.download(pack)
      .then(
        () => this.finished({ pack }),
        (error: unknown) => {
          const failure = failureOf(error);
          this.failures.set(id, failure);
          this.finished({ pack, failure });
        },
      )
      .catch(() => undefined)
      .finally(() => this.downloading.delete(id));
    return true;
  }

  private status(pack: DataPack, installed: DataPack | undefined): DataPackStatus {
    const { file: _file, sha256: _sha256, ...summary } = pack;
    const state = this.downloading.has(pack.id)
      ? "downloading"
      : installed === undefined
        ? "available"
        : installed.sha256 === pack.sha256
          ? "installed"
          : "update";
    const failure = this.failures.get(pack.id);
    return failure === undefined ? { ...summary, state } : { ...summary, state, failure };
  }

  private async download(pack: DataPack): Promise<void> {
    const key = pack.access === "key" ? await this.key() : undefined;
    const response = await fetch(`${STORE}/packs/${pack.file}`, { headers: authorization(key) });
    if (response.status === 401) throw new Error("key");
    if (!response.ok || response.body === null) throw new Error("unavailable");
    await mkdir(this.root, { recursive: true });
    const archive = join(this.root, `${pack.id}.zip`);
    const staged = join(this.root, `${pack.id}.new`);
    try {
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
        createWriteStream(archive),
      );
      if ((await digest(archive)) !== pack.sha256) throw new Error("invalid");
      await rm(staged, { recursive: true, force: true });
      await extract(archive, staged);
      await writeFile(join(staged, "pack.json"), JSON.stringify(pack));
      const target = join(this.root, LAW_PACK_DIRECTORIES[pack.jurisdiction]);
      const previous = `${target}.old`;
      await rm(previous, { recursive: true, force: true });
      this.release(pack);
      await rename(target, previous).catch(() => undefined);
      await rename(staged, target);
      this.release(pack);
      await rm(previous, { recursive: true, force: true });
    } finally {
      await rm(archive, { force: true });
    }
  }

  private async catalog(): Promise<DataPack[]> {
    const response = await fetch(`${STORE}/catalog`, {
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("unavailable");
    const signed = (await response.json()) as { catalog?: unknown; signature?: unknown };
    if (
      typeof signed.catalog !== "string" ||
      typeof signed.signature !== "string" ||
      !verify(
        null,
        Buffer.from(signed.catalog),
        this.signingKey,
        Buffer.from(signed.signature, "base64"),
      )
    )
      throw new Error("invalid");
    const packs = (JSON.parse(signed.catalog) as { packs?: unknown }).packs;
    return Array.isArray(packs)
      ? packs.flatMap((pack) => {
          const parsed = DataPackSchema.safeParse(pack);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  }

  private async installedPacks(): Promise<DataPack[]> {
    const packs: DataPack[] = [];
    for (const directory of Object.values(LAW_PACK_DIRECTORIES)) {
      const text = await readFile(join(this.root, directory, "pack.json"), "utf8").catch(
        () => undefined,
      );
      const parsed = text === undefined ? undefined : DataPackSchema.safeParse(JSON.parse(text));
      if (parsed?.success === true) packs.push(parsed.data);
    }
    return packs;
  }

  private async key(): Promise<string | undefined> {
    return (await readFile(join(this.root, "key"), "utf8").catch(() => undefined))?.trim();
  }
}
