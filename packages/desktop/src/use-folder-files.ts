import { useEffect, useState } from "react";
import type { DesktopApi } from "./api.js";

export function useFolderFiles(api: DesktopApi, folderId: string | undefined): string[] {
  const [loaded, setLoaded] = useState<{ folderId: string; names: string[] }>();
  useEffect(() => {
    if (folderId === undefined) return;
    let active = true;
    void api
      .sampleFolderFiles(folderId)
      .catch(() => [])
      .then((names) => {
        if (active) setLoaded({ folderId, names });
      });
    return () => {
      active = false;
    };
  }, [api, folderId]);
  return loaded !== undefined && loaded.folderId === folderId ? loaded.names : [];
}
