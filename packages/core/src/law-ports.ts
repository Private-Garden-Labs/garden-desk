import type { AuditLog } from "./audit/log.js";
import type { GardenDeskCorePorts } from "./facade.js";
import type { LawLibrary } from "./laws/law-library.js";

export type LawPorts = Pick<GardenDeskCorePorts, "listLaws" | "setLawEnabled">;

export function createLawPorts(laws: LawLibrary, audit: AuditLog): LawPorts {
  return {
    listLaws: async () => laws.list(),
    async setLawEnabled(id, enabled) {
      const changed = laws.setEnabled(id, enabled);
      audit.append({
        type: "law.availability_changed",
        outcome: "succeeded",
        metadata: { id, enabled },
      });
      return changed;
    },
  };
}
