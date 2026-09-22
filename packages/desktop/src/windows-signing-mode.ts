export type WindowsProductionSigning = {
  mode: "production";
  endpoint: string;
  account: string;
  certificateProfile: string;
  signingDlib: string;
};

export type WindowsSigningConfiguration = { mode: "development" } | WindowsProductionSigning;

export function windowsSigningConfiguration(
  environment: NodeJS.ProcessEnv,
): WindowsSigningConfiguration {
  const mode = environment.GARDEN_DESK_WINDOWS_SIGNING_MODE ?? "development";
  if (mode === "development") return { mode };
  if (mode !== "production") {
    throw new Error("GARDEN_DESK_WINDOWS_SIGNING_MODE must be development or production.");
  }
  const endpoint = environment.GARDEN_DESK_WINDOWS_SIGNING_ENDPOINT;
  const account = environment.GARDEN_DESK_WINDOWS_SIGNING_ACCOUNT;
  const certificateProfile = environment.GARDEN_DESK_WINDOWS_SIGNING_PROFILE;
  const signingDlib = environment.GARDEN_DESK_WINDOWS_SIGNING_DLIB;
  if (
    endpoint === undefined ||
    account === undefined ||
    certificateProfile === undefined ||
    signingDlib === undefined
  ) {
    throw new Error(
      "Production Windows signing requires the Artifact Signing endpoint, account, profile, and library.",
    );
  }
  return { mode, endpoint, account, certificateProfile, signingDlib };
}
