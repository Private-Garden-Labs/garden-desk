import { FolderFileNamesSchema } from "@gardendesk/shared";
import type { DesktopApi } from "./api.js";
import { invokeDesktop } from "./development-errors.js";

export const tauriFolderApi: Pick<DesktopApi, "sampleFolderFiles"> = {
  async sampleFolderFiles(folderId) {
    return invokeDesktop("sample_folder_files", (value) => FolderFileNamesSchema.parse(value), {
      folderId,
    });
  },
};
