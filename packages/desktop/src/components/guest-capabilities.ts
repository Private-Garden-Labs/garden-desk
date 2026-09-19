import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };

export function guestCapabilities(): string {
  const runtimes = Object.entries(capabilities.runtimes).map(
    ([name, version]) => `${name}: ${version}`,
  );
  return [
    `Source: ${capabilities.sourceMount.path} (${capabilities.sourceMount.mode}, live)`,
    `Workspace: ${capabilities.workspaceMount.path} (${capabilities.workspaceMount.maximumBytes} bytes)`,
    `Temporary runtime: ${capabilities.runtimeMount.path} (${capabilities.runtimeMount.maximumBytes} bytes, ephemeral)`,
    `Shell: ${capabilities.shell}`,
    "Runtimes:",
    ...runtimes,
    "Executables:",
    ...capabilities.executables,
  ].join("\n");
}
