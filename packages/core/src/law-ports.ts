import type { AuditLog } from "./audit/log.js";
import type { GardenDeskCorePorts } from "./facade.js";
import type { LawLibrary } from "./laws/law-library.js";

export type LawPorts = Pick<GardenDeskCorePorts, "listLaws" | "setLawEnabled">;

export function createLawPorts(laws: LawLibrary, audit: AuditLog): LawPorts {
  return {
    listLaws: async () => laws.list(),
    async setLawEnabled(id, enabled, source) {
      const changed = laws.setEnabled(id, enabled, source);
      audit.append({
        type: "law.availability_changed",
        outcome: changed ? "succeeded" : "failed",
        metadata: source === undefined ? { id, enabled } : { id, source, enabled },
      });
      return changed;
    },
  };
}
