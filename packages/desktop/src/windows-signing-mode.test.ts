import { describe, expect, it } from "vitest";
import { windowsSigningConfiguration } from "./windows-signing-mode.js";

describe("Windows signing mode", () => {
  it("uses the disposable development identity by default", () => {
    expect(windowsSigningConfiguration({})).toEqual({ mode: "development" });
  });

  it("requires the complete production Artifact Signing configuration", () => {
    expect(
      windowsSigningConfiguration({
        GARDEN_DESK_WINDOWS_SIGNING_MODE: "production",
        GARDEN_DESK_WINDOWS_SIGNING_ENDPOINT: "https://plc.codesigning.azure.net/",
        GARDEN_DESK_WINDOWS_SIGNING_ACCOUNT: "Beaverr",
        GARDEN_DESK_WINDOWS_SIGNING_PROFILE: "garden-desk",
        GARDEN_DESK_WINDOWS_SIGNING_DLIB: "C:/tools/Azure.CodeSigning.Dlib.dll",
      }),
    ).toEqual({
      mode: "production",
      endpoint: "https://plc.codesigning.azure.net/",
      account: "Beaverr",
      certificateProfile: "garden-desk",
      signingDlib: "C:/tools/Azure.CodeSigning.Dlib.dll",
    });
    expect(() =>
      windowsSigningConfiguration({ GARDEN_DESK_WINDOWS_SIGNING_MODE: "production" }),
    ).toThrow("Artifact Signing");
  });
});
