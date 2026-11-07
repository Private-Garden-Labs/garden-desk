import type { DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";
import { record } from "./tauri-parse.js";

export const tauriRecordApi: Pick<DesktopApi, "exportWorkRecord"> = {
  async exportWorkRecord(sessionId, labels) {
    return invokeDesktop(
      "export_work_record",
      (value) => {
        if (value === null) return undefined;
        const { file, verified } = record(value);
        if (typeof file !== "string")
          throw new Error("The desktop bridge returned an invalid response.");
        return { file, verified: verified === true };
      },
      { sessionId, labels },
    );
  },
};
