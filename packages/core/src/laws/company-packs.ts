import { createHash, createPublicKey, verify } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AuditEventInput,
  type CompanyPackBuild,
  type CompanyPackImport,
  type CompanyPackManifest,
  CompanyPackManifestSchema,
  type CompanyPacks,
  type Jurisdiction,
  packDirectory,
} from "@gardendesk/shared";
import { digest } from "../runtime/models.js";
import { inspectFolderGrant } from "../workspace/folder-grants.js";
import {
  buildCompanyPack,
  type CompanyPackRequest,
  type ExtractDocuments,
  publisherKey,
} from "./company-pack-build.js";
import { extract, replaceDirectory } from "./data-packs.js";
import type { Embed } from "./law-library.js";

const MANIFEST_BYTES = 65_536;

interface Publisher {
  name: string;
  publicKey: string;
  fingerprint: string;
}

export interface CompanyPackOptions {
  root: string;
  embed: Embed;
  extract: ExtractDocuments;
  release(id: Jurisdiction): void;
  audit(event: AuditEventInput): void;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function fingerprintOf(publicKey: string): string {
  const hash = createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex");
  return hash.slice(0, 32).replace(/(.{4})(?=.)/gu, "$1 ");
}

export class CompanyPackStore {
  private build: CompanyPackBuild = { state: "idle" };
  private building: Promise<void> = Promise.resolve();
  private imported: CompanyPackImport = { status: "idle" };

  constructor(private readonly options: CompanyPackOptions) {}

  async status(): Promise<CompanyPacks> {
    const { root } = this.options;
    const saved = await readFile(join(root, "company-folder"), "utf8").catch(() => undefined);
    const installed = new Set(await readdir(join(root, "company")).catch(() => []));
    const names = saved === undefined ? [] : await readdir(saved).catch(() => []);
    const files = names
      .filter((name) => name.endsWith(".gdpack") && !installed.has(name.slice(0, -7)))
      .sort()
      .map((name) => ({ name, path: join(saved ?? "", name) }));
    return { folder: saved ?? null, files, build: this.build, import: this.imported };
  }

  async setFolder(path: string): Promise<void> {
    await mkdir(this.options.root, { recursive: true });
    await writeFile(
      join(this.options.root, "company-folder"),
      inspectFolderGrant(path).canonicalPath,
    );
  }

  start(request: CompanyPackRequest): boolean {
    if (this.build.state === "building") return false;
    const source = inspectFolderGrant(request.source).canonicalPath;
    const output = inspectFolderGrant(request.output).canonicalPath;
    this.build = { state: "building" };
    this.building = mkdir(this.options.root, { recursive: true })
      .then(() => publisherKey(join(this.options.root, "publisher-key.json")))
      .then((key) => buildCompanyPack({ ...request, source, output }, key, this.options))
      .then(
        (built) => {
          this.build = { state: "built", ...built };
        },
        (error: unknown) => {
          this.build = { state: "failed", reason: reasonOf(error) };
        },
      );
    return true;
  }

  close(): Promise<void> {
    return this.building;
  }

  startImport(path: string, trust?: string): boolean {
    if (this.imported.status === "importing") return false;
    this.imported = { status: "importing" };
    void this.import(path, trust).then(
      (result) => {
        this.imported = result;
      },
      (error: unknown) => {
        this.imported = { status: "failed", reason: reasonOf(error) };
      },
    );
    return true;
  }

  async import(path: string, trust?: string): Promise<CompanyPackImport> {
    const company = join(this.options.root, "company");
    await mkdir(company, { recursive: true });
    const staged = await mkdtemp(join(company, ".import-"));
    try {
      const manifest = await this.verified(path, staged).catch(() => undefined);
      if (manifest === undefined) return { status: "invalid" };
      const fingerprint = fingerprintOf(manifest.publicKey);
      const trusted = await this.trusts(manifest.publicKey);
      if (!trusted && trust !== fingerprint)
        return { status: "untrusted", path, publisher: manifest.publisher, fingerprint };
      if (!(await this.unpacked(path, staged, manifest))) return { status: "invalid" };
      if (!trusted)
        await this.trust({ name: manifest.publisher, publicKey: manifest.publicKey, fingerprint });
      await this.install(staged, manifest);
      return { status: "installed", id: manifest.jurisdiction };
    } finally {
      await rm(staged, { recursive: true, force: true });
    }
  }

  private async install(staged: string, manifest: CompanyPackManifest): Promise<void> {
    const { publicKey: _publicKey, ...pack } = manifest;
    await rename(join(staged, "pack.sqlite"), join(staged, "law-library.sqlite"));
    await writeFile(join(staged, "pack.json"), JSON.stringify(pack));
    const target = join(this.options.root, packDirectory(pack.jurisdiction));
    await replaceDirectory(staged, target, () => this.options.release(pack.jurisdiction));
    this.options.audit({
      type: "data_pack.installed",
      outcome: "succeeded",
      metadata: { id: pack.jurisdiction, sha256: pack.sha256 },
    });
  }

  private async unpacked(
    path: string,
    staged: string,
    manifest: CompanyPackManifest,
  ): Promise<boolean> {
    return extract(path, staged, new Map([["pack.sqlite", manifest.bytes]]))
      .then(() => digest(join(staged, "pack.sqlite")))
      .then(
        (sha256) => sha256 === manifest.sha256,
        () => false,
      );
  }

  private async verified(path: string, staged: string): Promise<CompanyPackManifest> {
    await extract(
      path,
      staged,
      new Map([
        ["manifest.json", MANIFEST_BYTES],
        ["manifest.sig", MANIFEST_BYTES],
      ]),
    );
    const bytes = await readFile(join(staged, "manifest.json"));
    const manifest = CompanyPackManifestSchema.parse(JSON.parse(bytes.toString("utf8")));
    const key = createPublicKey({
      key: Buffer.from(manifest.publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    const valid =
      key.asymmetricKeyType === "ed25519" &&
      verify(null, bytes, key, await readFile(join(staged, "manifest.sig"))) &&
      manifest.jurisdiction === `company:${manifest.id}`;
    if (!valid) throw new Error("invalid");
    return manifest;
  }

  private async publishers(): Promise<Publisher[]> {
    const saved = await readFile(join(this.options.root, "publishers.json"), "utf8").catch(
      () => "[]",
    );
    return JSON.parse(saved) as Publisher[];
  }

  private async trusts(publicKey: string): Promise<boolean> {
    return (await this.publishers()).some((publisher) => publisher.publicKey === publicKey);
  }

  private async trust(publisher: Publisher): Promise<void> {
    const publishers = [...(await this.publishers()), publisher];
    await writeFile(
      join(this.options.root, "publishers.json"),
      `${JSON.stringify(publishers, null, 2)}\n`,
    );
    this.options.audit({
      type: "publisher.trusted",
      outcome: "succeeded",
      metadata: { name: publisher.name, fingerprint: publisher.fingerprint },
    });
  }
}
