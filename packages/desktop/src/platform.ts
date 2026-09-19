export type DesktopPlatform = "macos" | "windows" | "other";

export function desktopPlatform(userAgent: string): DesktopPlatform {
  if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) return "macos";
  if (userAgent.includes("Windows")) return "windows";
  return "other";
}
