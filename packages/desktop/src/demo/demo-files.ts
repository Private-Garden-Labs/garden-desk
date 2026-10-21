import type { NativeDropEvent } from "../api.js";

export function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.addEventListener("change", () => resolve([...(input.files ?? [])]));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

export async function contentHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0"));
  return `sha256:${hex.join("")}`;
}

// Turns browser file drags into the desktop app's native drop events.
export function listenForBrowserDrops(
  listener: (event: NativeDropEvent) => void,
  onFiles: (files: File[]) => void,
): () => void {
  let depth = 0;
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") === true;
  const enter = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth += 1;
    if (depth === 1) listener({ type: "enter", paths: ["document"] });
  };
  const over = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    listener({ type: "over" });
  };
  const leave = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) listener({ type: "leave" });
  };
  const drop = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth = 0;
    const dropped = [...(event.dataTransfer?.files ?? [])];
    onFiles(dropped);
    listener({ type: "drop", paths: dropped.map((file) => file.name) });
  };
  window.addEventListener("dragenter", enter);
  window.addEventListener("dragover", over);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", drop);
  return () => {
    window.removeEventListener("dragenter", enter);
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
  };
}
