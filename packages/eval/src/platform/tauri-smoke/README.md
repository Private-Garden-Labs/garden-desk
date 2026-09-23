# M0 Tauri Capability Smoke

This committed shell validates the native boundary only. It is not product UI.

## Selected Sidecar Path

The sidecar is a Node 24.18.0 Single Executable Application. `esbuild` bundles the fixed TypeScript fixture to one CommonJS file, Node creates a SEA blob, and the Node-maintained `postject` tool injects it into the exact pinned Node executable. Injection invalidates existing platform signatures, so signing always happens afterward.

The build enforces the pinned Node version and records the source Node executable SHA-256, `pnpm-lock.yaml` SHA-256, final executable SHA-256, target triple, and signing mode in the uncommitted `.generated/build-record.json`. Tauri receives the executable under its required target-triple name. The fixture accepts no arguments and opens no endpoint.

macOS smoke builds use ad-hoc `codesign` and verify the final binary with `codesign --verify --strict`. Windows smoke builds remove the upstream Node signature before SEA injection, create an ephemeral current-user code-signing certificate, sign with `Set-AuthenticodeSignature`, and require an intact Authenticode signer. The disposable identity is deliberately not added to a trusted root store, so its chain is not production-trusted. Release builds must replace those identities with the release certificate in the packaging system; unsigned or identity-mismatched outputs fail before Tauri packaging.

Node SEA is still marked active development by Node. `postject` is an alpha-tagged package, but it is the injector documented by Node 24. The M0 harness pins it and verifies the final executable.

## Capability Boundary

The webview has only `core:default`. It has no shell, process, filesystem, dialog, HTTP, URL-opening, or environment plugin permission. The only application command is `launch_test_sidecar`; it accepts no executable, arguments, path, URL, endpoint, or model location. Rust resolves the single configured external binary by its fixed Tauri sidecar identity.

After the runtime checks finish, the webview writes the bounded JSON evidence to its body and emits it through the existing `core:event:default` channel. The Rust test host listens only for `m0-runtime-evidence` and prints that payload, so platform automation can capture the result without screenshots, unrelated application access, or an added capability. A passing payload contains the fixed sidecar response and `arbitraryCommandDenied: true`.

## Commands

- `pnpm tauri:build-sidecar` builds and signs the current-platform fixture.
- `pnpm tauri:check` builds the fixture and compiles the test-only shell without a bundle.
- `pnpm verify:rust` formats and lints the Rust boundary.

M0 closure required webview launch evidence on both supported platforms. CI compilation and source-level denial tests did not substitute for that evidence.
