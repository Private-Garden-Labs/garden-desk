import type { AuditLog } from "./audit/log.js";
import type { GardenDeskCorePorts } from "./facade.js";
import type { DataPackStore } from "./laws/data-packs.js";
import type { LawLibrary } from "./laws/law-library.js";

export type LawPorts = Pick<
  GardenDeskCorePorts,
  | "listLaws"
  | "readLaw"
  | "lawCitations"
  | "lawSourceUrl"
  | "setLawEnabled"
  | "listDataPacks"
  | "saveDataPackKey"
  | "installDataPack"
>;

export function createLawPorts(
  laws: LawLibrary,
  dataPacks: DataPackStore,
  audit: AuditLog,
): LawPorts {
  return {
    listLaws: async () => laws.list(),
    readLaw: async (id, source) => laws.read(id, source),
    lawCitations: async () => laws.citations(),
    lawSourceUrl: async (id, source) =>
      laws
        .list()
        .find((law) => law.id === id)
        ?.sources.find((item) => item.id === source)?.url,
    async setLawEnabled(id, enabled, source) {
      const changed = laws.setEnabled(id, enabled, source);
      audit.append({
        type: "law.availability_changed",
        outcome: changed ? "succeeded" : "failed",
        metadata: source === undefined ? { id, enabled } : { id, source, enabled },
      });
      return changed;
    },
    listDataPacks: () => dataPacks.list(),
    async saveDataPackKey(key) {
      const saved = await dataPacks.saveKey(key);
      audit.append({
        type: "data_pack.key_saved",
        outcome: saved ? "succeeded" : "failed",
        metadata: {},
      });
      return saved;
    },
    installDataPack: (id) => dataPacks.install(id),
  };
}
