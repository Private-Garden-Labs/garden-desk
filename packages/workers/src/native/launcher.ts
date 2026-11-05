import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Duplex } from "node:stream";

export interface NativeWorkerLaunchRequest {
  workerEntryPath: string;
  modelPath?: string;
  memoryBudgetBytes: number;
  serverArguments?: string[];
  readPaths?: string[];
  splash?: boolean;
}

export interface NativeWorkerHandle {
  process: ChildProcessWithoutNullStreams;
  connect?(): Duplex;
  dispose(): Promise<void>;
}

export interface NativeWorkerLauncher {
  readonly splash?: boolean;
  readonly gpu?:
    | {
        backend: "cuda" | "hip" | "metal";
        memoryKind?: "dedicated" | "unified";
        detectedMemoryBytes?: number;
      }
    | undefined;
  availableMemoryBytes?(): Promise<number | undefined>;
  launch(request: NativeWorkerLaunchRequest): Promise<NativeWorkerHandle>;
}

export class NativeWorkerLaunchError extends Error {
  constructor(
    readonly code: "unsupported",
    message: string,
  ) {
    super(message);
  }
}
