import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type DevelopmentModel,
  DevelopmentModelListSchema,
  type DevelopmentModelSettings,
} from "@gardendesk/shared";

const SETTINGS_FILE = "dev-openrouter.json";

export interface StoredDevelopmentSettings {
  favorites: DevelopmentModel[];
  apiKey?: string;
}

function storedApiKey(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function storedSettings(content: unknown): StoredDevelopmentSettings {
  const record =
    typeof content === "object" && content !== null ? (content as Record<string, unknown>) : {};
  const favorites = DevelopmentModelListSchema.safeParse(record.favorites);
  const apiKey = storedApiKey(record.apiKey);
  return {
    favorites: favorites.success ? favorites.data : [],
    ...(apiKey === undefined ? {} : { apiKey }),
  };
}

/** The unencrypted development key and favorites, kept in Core's private state folder. */
export class DevelopmentSettingsStore {
  private readonly path: string;

  constructor(stateDirectory: string) {
    this.path = join(stateDirectory, ".garden-desk", SETTINGS_FILE);
  }

  async read(): Promise<StoredDevelopmentSettings> {
    try {
      return storedSettings(JSON.parse(await readFile(this.path, "utf8")));
    } catch {
      return { favorites: [] };
    }
  }

  async write(settings: StoredDevelopmentSettings): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const content = { schemaVersion: 1, ...settings };
    await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, this.path);
  }
}

export function developmentSettingsView(
  settings: StoredDevelopmentSettings,
): DevelopmentModelSettings {
  const lastFour = settings.apiKey !== undefined && settings.apiKey.length >= 4;
  return {
    favorites: settings.favorites,
    keyPresent: settings.apiKey !== undefined,
    ...(lastFour ? { keyLastFour: (settings.apiKey as string).slice(-4) } : {}),
  };
}
