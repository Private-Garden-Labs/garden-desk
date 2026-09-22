import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type WindowsProductionSigning,
  windowsSigningConfiguration,
} from "./src/windows-signing-mode.js";

const windowsTimestampUrl = "http://timestamp.acs.microsoft.com";

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { encoding: "utf8", env, stdio: "pipe" });
  if (result.status === 0) return;
  const detail = result.error?.message ?? result.stderr ?? result.stdout ?? "unknown failure";
  throw new Error(`${command} failed: ${detail}`);
}

function windowsPowerShell(): { executable: string; modulePath: string } {
  const windowsRoot = process.env.WINDIR ?? "C:\\Windows";
  const root = join(windowsRoot, "System32", "WindowsPowerShell", "v1.0");
  return { executable: join(root, "powershell.exe"), modulePath: join(root, "Modules") };
}

export function stripWindowsSignature(executable: string): void {
  const programFiles = process.env["ProgramFiles(x86)"];
  if (programFiles === undefined) throw new Error("Missing 64-bit Windows SDK location.");
  const powerShell = windowsPowerShell();
  const script =
    '$s=Get-ChildItem "$env:GARDEN_DESK_WINDOWS_KITS\\*\\x64\\signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1;if($null -eq $s){exit 1};& $s.FullName remove /s $env:GARDEN_DESK_SIGN_PATH;exit $LASTEXITCODE';
  run(powerShell.executable, ["-NoProfile", "-NonInteractive", "-Command", script], {
    ...process.env,
    PSModulePath: powerShell.modulePath,
    GARDEN_DESK_SIGN_PATH: executable,
    GARDEN_DESK_WINDOWS_KITS: join(programFiles, "Windows Kits", "10", "bin"),
  });
}

function signWindowsDevelopment(executable: string): string {
  const powerShell = windowsPowerShell();
  const script =
    "$p=$env:GARDEN_DESK_SIGN_PATH;$c=$null;try{$c=New-SelfSignedCertificate -Subject 'CN=Garden Desk M3 Development' -Type CodeSigningCert -CertStoreLocation Cert:\\CurrentUser\\My;Set-AuthenticodeSignature -FilePath $p -Certificate $c | Out-Null;$s=Get-AuthenticodeSignature -FilePath $p;$ok=$null -ne $s.SignerCertificate -and $s.Status -ne 'HashMismatch' -and $s.Status -ne 'NotSigned'}finally{if($null -ne $c){Remove-Item ('Cert:\\CurrentUser\\My\\'+$c.Thumbprint)}};if(-not $ok){exit 1}";
  run(powerShell.executable, ["-NoProfile", "-NonInteractive", "-Command", script], {
    ...process.env,
    PSModulePath: powerShell.modulePath,
    GARDEN_DESK_SIGN_PATH: executable,
  });
  return "windows-ephemeral-self-signed";
}

function windowsSignTool(): string {
  const programFiles = process.env["ProgramFiles(x86)"];
  if (programFiles === undefined) throw new Error("Missing 64-bit Windows SDK location.");
  const root = join(programFiles, "Windows Kits", "10", "bin");
  for (const version of readdirSync(root).sort().reverse()) {
    const candidate = join(root, version, "x64", "signtool.exe");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Missing Windows SDK signtool.exe.");
}

function signWindowsProduction(executable: string, signing: WindowsProductionSigning): string {
  const signTool = windowsSignTool();
  const directory = mkdtempSync(join(tmpdir(), "garden-desk-signing-"));
  try {
    const metadata = join(directory, "metadata.json");
    writeFileSync(
      metadata,
      JSON.stringify({
        Endpoint: signing.endpoint,
        CodeSigningAccountName: signing.account,
        CertificateProfileName: signing.certificateProfile,
      }),
    );
    run(signTool, [
      "sign",
      "/fd",
      "SHA256",
      "/tr",
      windowsTimestampUrl,
      "/td",
      "SHA256",
      "/dlib",
      signing.signingDlib,
      "/dmdf",
      metadata,
      executable,
    ]);
    run(signTool, ["verify", "/pa", executable]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return `windows-artifact-signing-${signing.account}-${signing.certificateProfile}`;
}

function signWindows(executable: string): string {
  const configuration = windowsSigningConfiguration(process.env);
  return configuration.mode === "development"
    ? signWindowsDevelopment(executable)
    : signWindowsProduction(executable, configuration);
}

export function signExecutable(executable: string, entitlements?: string): string {
  if (process.platform === "win32") return signWindows(executable);
  const identity = process.env.APPLE_SIGNING_IDENTITY;
  const args = ["--force", "--sign", identity ?? "-"];
  if (identity !== undefined) args.push("--options", "runtime", "--timestamp");
  if (entitlements !== undefined) args.push("--entitlements", entitlements);
  run("codesign", [...args, executable]);
  run("codesign", ["--verify", "--strict", executable]);
  return identity === undefined ? "macos-adhoc" : `macos-identity-${identity}`;
}
