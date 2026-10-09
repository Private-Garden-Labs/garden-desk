import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  NativeWorkerHandle,
  NativeWorkerLauncher,
  NativeWorkerLaunchRequest,
} from "./launcher.js";
import { NativeWorkerLaunchError } from "./launcher.js";

function literal(path: string): string {
  return JSON.stringify(resolve(path));
}

function credentialPaths(): string[] {
  return [
    ".aws",
    ".azure",
    ".config/gcloud",
    ".config/gh",
    ".docker",
    ".kube",
    ".netrc",
    ".npmrc",
    ".ssh",
    "Library/Keychains",
  ].map((path) => join(homedir(), path));
}

function runtimeReadPaths(workerEntryPath: string): string[] {
  const workerDirectory = dirname(workerEntryPath);
  const packagedModules = join(workerDirectory, "node_modules");
  if (existsSync(packagedModules)) return [workerDirectory, packagedModules];
  return [
    resolve(workerDirectory, "../.."),
    resolve(workerDirectory, "../../..", "shared"),
    resolve(workerDirectory, "../../../..", "node_modules"),
  ];
}

const SYSTEM_READ_PATHS = ["/System", "/usr/lib"];

// Serves the unmodified Splash HTTP server on the private Unix socket instead of TCP.
const SPLASH_SERVE = [
  "import os, socket, socketserver, sys",
  "path, root = sys.argv[1:3]",
  "sys.path.insert(0, os.path.join(root, 'server'))",
  "sys.argv = ['server.py', *sys.argv[3:], '--binary', os.path.join(root, 'engine', 'splash'), '--no-webui']",
  "import server",
  "class UnixServer(server.FrontendServer):",
  "    address_family = socket.AF_UNIX",
  "    def __init__(self, _address, *args, **kwargs): super().__init__(path, *args, **kwargs)",
  "    def server_bind(self):",
  "        socketserver.TCPServer.server_bind(self)",
  "        self.server_name, self.server_port = 'localhost', 0",
  "    def server_activate(self):",
  "        super().server_activate()",
  "        print('listening on unix://' + path, flush=True)",
  "server.FrontendServer = UnixServer",
  "server.main()",
].join("\n");

function parentPaths(path: string): string[] {
  const parents: string[] = [];
  let current = resolve(path);
  while (current !== dirname(current)) {
    current = dirname(current);
    parents.push(current);
  }
  return parents;
}

function hostDataDeny(
  readPaths: string[],
  temporaryRoot: string,
  runtimeExecutable: string,
  modelPaths: string[] = [],
): string {
  const exceptions = [
    '(literal "/")',
    ...parentPaths(temporaryRoot).map((path) => `(literal ${literal(path)})`),
    ...SYSTEM_READ_PATHS.map((path) => `(subpath ${literal(path)})`),
    ...readPaths.map((path) => `(subpath ${literal(path)})`),
    `(literal ${literal(runtimeExecutable)})`,
    `(literal ${literal(temporaryRoot)})`,
    `(subpath ${literal(temporaryRoot)})`,
    ...modelPaths.map((path) => `(subpath ${literal(path)})`),
  ];
  const outsideExceptions = exceptions.map((rule) => `(require-not ${rule})`).join(" ");
  return `(deny file-read-data (require-all (subpath "/") ${outsideExceptions}))`;
}

interface RuntimeCommand {
  executable: string;
  /** Every program the sandbox may start: the executable and, for Splash, its engine. */
  executables: string[];
  readPaths: string[];
  args: string[];
}

function sandboxProfile(
  request: NativeWorkerLaunchRequest,
  temporaryRoot: string,
  deniedPaths: string[],
  command: RuntimeCommand,
): string {
  const { executable: runtimeExecutable, readPaths } = command;
  const protectedRules = [...deniedPaths, ...credentialPaths()]
    .map((path) => `(subpath ${literal(path)})`)
    .join(" ");
  const server = request.serverArguments !== undefined;
  const modelPaths =
    request.readPaths ?? (request.modelPath === undefined ? [] : [request.modelPath]);
  const socket = literal(join(temporaryRoot, "s.sock"));
  return [
    "(version 1)",
    "(allow default)",
    "(deny network*)",
    ...(server
      ? [
          `(allow network-bind (local unix-socket (literal ${socket})))`,
          `(allow network-inbound (local unix-socket (literal ${socket})))`,
        ]
      : []),
    '(deny mach-lookup (global-name "com.apple.securityd"))',
    hostDataDeny(readPaths, temporaryRoot, runtimeExecutable, modelPaths),
    `(deny file-write* (require-not (subpath ${literal(temporaryRoot)})))`,
    "(deny process-fork)",
    ...(command.executables.length > 1 ? ["(allow process-fork)"] : []),
    "(deny process-exec)",
    `(allow process-exec ${command.executables.map((path) => `(literal ${literal(path)})`).join(" ")})`,
    `(allow file-read* (literal ${literal(runtimeExecutable)}))`,
    ...SYSTEM_READ_PATHS.map((path) => `(allow file-read* (subpath ${literal(path)}))`),
    ...readPaths.map((path) => `(allow file-read* (subpath ${literal(path)}))`),
    ...modelPaths.map((path) => `(allow file-read* (subpath ${literal(path)}))`),
    `(allow file-read* (subpath ${literal(temporaryRoot)}))`,
    `(allow file-write* (subpath ${literal(temporaryRoot)}))`,
    ...(protectedRules === "" ? [] : [`(deny file-read* ${protectedRules})`]),
  ].join("\n");
}

export class MacOsNativeWorkerLauncher implements NativeWorkerLauncher {
  readonly splash = true;
  readonly gpu = { backend: "metal", memoryKind: "unified" } as const;
  constructor(
    private readonly deniedPaths: string[] = [],
    private readonly runtimeExecutable: string = resolve(
      "packages/eval/.generated/inference/macos-arm64/llama-server",
    ),
    private readonly splashRoot: string = join(
      dirname(dirname(runtimeExecutable)),
      "macos-arm64-splash",
    ),
  ) {}

  private command(request: NativeWorkerLaunchRequest, socket: string): RuntimeCommand {
    const serverArguments = request.serverArguments;
    if (serverArguments === undefined) {
      const args = [
        "--conditions=gardendesk-runtime",
        request.workerEntryPath,
        "--memory-budget",
        String(request.memoryBudgetBytes),
        ...(request.modelPath === undefined ? [] : ["--model", request.modelPath]),
      ];
      const readPaths = runtimeReadPaths(request.workerEntryPath);
      return { executable: process.execPath, executables: [process.execPath], readPaths, args };
    }
    if (request.splash !== true) {
      const executable = this.runtimeExecutable;
      const args = ["--host", socket, ...serverArguments];
      return { executable, executables: [executable], readPaths: [dirname(executable)], args };
    }
    const executable = join(this.splashRoot, "python", "bin", "python3.13");
    return {
      executable,
      executables: [executable, join(this.splashRoot, "engine", "splash")],
      readPaths: [this.splashRoot],
      args: ["-I", "-B", "-c", SPLASH_SERVE, socket, this.splashRoot, ...serverArguments],
    };
  }

  async launch(request: NativeWorkerLaunchRequest): Promise<NativeWorkerHandle> {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      throw new NativeWorkerLaunchError("unsupported", "unsupported_native_worker_platform");
    }
    const temporaryAlias = await mkdtemp(join(tmpdir(), "gd-"));
    const temporaryRoot = await realpath(temporaryAlias);
    const command = this.command(request, join(temporaryRoot, "s.sock"));
    const profile = sandboxProfile(request, temporaryRoot, this.deniedPaths, command);
    const args = ["-p", profile, command.executable, ...command.args];
    const child = spawn("/usr/bin/sandbox-exec", args, {
      cwd: temporaryRoot,
      env: {
        HOME: temporaryRoot,
        TMPDIR: temporaryRoot,
        PATH: "/usr/bin:/bin",
        NODE_NO_WARNINGS: "1",
        HF_HUB_OFFLINE: "1",
        HF_HUB_DISABLE_TELEMETRY: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const exited = new Promise<void>((accept) => {
      child.once("close", () => accept());
      child.once("error", () => accept());
    });
    let disposed = false;
    return {
      process: child,
      ...(request.serverArguments === undefined
        ? {}
        : { connect: () => createConnection(join(temporaryRoot, "s.sock")) }),
      async dispose() {
        if (disposed) return;
        disposed = true;
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        await exited;
        await rm(temporaryRoot, { recursive: true, force: true });
      },
    };
  }
}
