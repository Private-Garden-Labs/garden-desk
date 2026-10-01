# Development Workflow

How to set up, change, verify, review, and release Garden Desk. [AGENTS.md](../AGENTS.md) is authoritative. [ARCHITECTURE.md](ARCHITECTURE.md) describes what V1 is.

## Local Source Setup

After cloning, run the setup command for your platform:

- Apple silicon macOS: `bash setup.sh`.
- Windows 11 x64 Pro or Enterprise with Hyper-V enabled: run `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1` in standard PowerShell.

Setup checks the required tools and asks before it installs a missing one. After you approve, it installs the locked packages, downloads missing model and runtime files, builds a missing guest image (Docker with Linux containers), and starts the app. The first setup needs an internet connection. If an installer asks you to restart, restart and run setup again. On Windows, after the helper adds you to Hyper-V Administrators, sign out and back in.

Later, `pnpm start` runs `pnpm desktop:dev`. Run setup again when dependencies or required assets change. The development terminal shows WebView and Core output. That output is not stored and must never include prompts, messages, tool payloads, reasoning, or file contents.

## Make A Change

1. Work from a direct owner request. Use the `garden-desk-plan-change` skill for anything non-trivial.
2. Search the repository and maintained dependencies first. For a new dependency, use the `garden-desk-review-dependency` skill.
3. Make the smallest change on a short-lived branch and open a pull request. Follow the Test Rule in [AGENTS.md](../AGENTS.md#test-rule). For a bug, use the `garden-desk-fix-bug` skill.

## Verify

Use the smallest row that matches the change. The `garden-desk-verify-change` skill writes the report.

| Change | Local verification |
| --- | --- |
| Documentation or instructions only | Check links and command names, and run `git diff --check`. |
| Focused source change | `pnpm lint`, `pnpm typecheck`, and the one test the Test Rule requires, if any. Platform boundary: `pnpm test:platform:gate`. Native inference boundary: `pnpm test:native:m2`. |
| Native helper, build script, or packaged runtime | `pnpm verify`. |
| Real model, physical microVM, golden task, or milestone gate | Only with explicit owner approval (see below). |

CI runs `pnpm verify` (which includes the full test suite) on pull requests. Pushes to `main` do not run it. Report a check you did not run as not run, never as passed.

## Review

Use the `garden-desk-review-change` skill. Review security and privacy first, then correctness and recovery, then minimum code. Severities:

- **P0**: data exposure, authority bypass, or destructive behavior.
- **P1**: broken contract, correctness, recovery, or approval rule.
- **P2**: unnecessary code or tests, scope creep, or a dependency gap.
- **P3**: low-risk clarity fix.

The GitHub review follows [REVIEW.md](../REVIEW.md). Its CRITICAL maps to P0 and P1, WARNING to P2, and SUGGESTION to P3. Use the `garden-desk-handoff` skill when work moves to someone else.

## Real-Model Reproduction

Use this only as a last resort, and only after the owner approves the exact command and number of runs (see [AGENTS.md](../AGENTS.md#top-priority-minimum-work)). Raw inference diagnostics stay private and out of Git.

- `pnpm test:m3:macos` and `pnpm test:m3:windows` run the guest isolation probes. They then run four golden folder tasks (XLSX, DOCX, PDF, and a mixed-folder report) with deterministic checks, and print `golden: N/4 passed`. Report that count to the owner.
- `pnpm model:compare`, `pnpm model:compare:agent`, and `pnpm model:compare:report` compare model or runtime candidates.
- For a task-specific reproduction, write an ignored script under `packages/eval/.generated/`. Start Core with `createGardenDeskCore` and `startDaemon`, then drive it through `packages/cli/src/client.ts` until the run ends. Put the workspace directly under `/tmp` so the macOS socket path stays short. A sandbox `listen EPERM` or a Virtualization.framework denial is not a product failure.
- Report Windows results separately. Never infer them from macOS.

## Platform Notes

- Windows `desktop:dev` passes `--no-watch` to Tauri, because NTFS notifications cause a rebuild loop. Restart it after you change Rust desktop code.
- Windows development builds sign with a disposable current-user identity. A production build sets `GARDEN_DESK_WINDOWS_SIGNING_MODE=production`, plus `GARDEN_DESK_WINDOWS_SIGNING_ENDPOINT`, `GARDEN_DESK_WINDOWS_SIGNING_ACCOUNT`, `GARDEN_DESK_WINDOWS_SIGNING_PROFILE`, and `GARDEN_DESK_WINDOWS_SIGNING_DLIB` (the path of `Azure.CodeSigning.Dlib.dll`). It signs with `signtool` and timestamps with `http://timestamp.acs.microsoft.com`. The signed-in Azure identity needs the Artifact Signing Certificate Profile Signer role. The build fails closed if a value or `signtool` is missing, or if verification fails.
- `assets/inference-runtime.json` pins a `stagedSha256` per platform. Packaging stops on a mismatch. A file that already carries a valid vendor signature keeps it.
- macOS development builds sign ad hoc. A production build sets `APPLE_SIGNING_IDENTITY` to the Developer ID Application identity. It signs the sidecar, inference runtime, and VZ helper with the hardened runtime, then notarizes and staples the DMG with the `garden-desk` notary profile. Create that profile once with `xcrun notarytool store-credentials garden-desk --key <AuthKey_ID.p8> --key-id <key ID> --issuer <issuer ID>`. Allow the terminal to control Finder for the DMG layout, or set `CI=true` to skip the layout.

## Publish A Release

A download link must not go live before its file and SHA-256 exist.

1. Build and sign on each platform. Name the files `Garden-Desk-<version>-macos-arm64.dmg` and `Garden-Desk-<version>-windows-x64.zip`, and record each SHA-256.
2. Upload each file to the Cloudflare R2 bucket `garden-desk-releases`. Use the key `v<version>/<file name>`, the header `Content-Disposition: attachment; filename="<file name>"`, and the custom metadata `sha256`. For files over 5 GiB, use a multipart upload through the R2 S3 API, or through a temporary Worker that accepts parts of at most 100 MB. Delete that Worker afterwards.
3. Do not open a download address before its upload. Cloudflare caches the `404` for up to 4 hours. If that happens, purge only that URL in the `gardendesk.ai` zone.
4. Confirm that `https://downloads.gardendesk.ai/v<version>/<file name>` returns `200` and that the full download matches the SHA-256.
5. In one pull request, update the links in `site/index.html`, the links and SHA-256 values in `site/releases/index.html`, and the links in `scripts/check-site.ts`. Run `pnpm site:check`.
6. After the merge, the "Deploy public website" workflow publishes the site. Check it with `curl -s https://gardendesk.ai/ | rg data-download`.

## Website Admin And Blog

The admin runs at `admin.gardendesk.ai` behind Cloudflare Access. The Worker also validates the Access token and requires the same origin for blog changes. Posts live in the D1 database, and only published posts appear on `/blog/`, in the sitemap, and in the RSS feed. Apply the database migration before deployment. Add the admin hostname to Access before you add its Worker route. To work locally, run `pnpm site:admin`.

Claude Code and Codex can manage posts through the MCP endpoint (Model Context Protocol, the way coding agents connect to tools) at `https://admin.gardendesk.ai/mcp`. To set it up, create a Cloudflare Access service token and add a Service Auth policy for it. Keep the token's ID and secret in `GARDEN_ACCESS_CLIENT_ID` and `GARDEN_ACCESS_CLIENT_SECRET`. Locally, `http://127.0.0.1:4175/mcp` needs no token.

```bash
claude mcp add --transport http garden-blog https://admin.gardendesk.ai/mcp --header "CF-Access-Client-Id: $GARDEN_ACCESS_CLIENT_ID" --header "CF-Access-Client-Secret: $GARDEN_ACCESS_CLIENT_SECRET"
```

```toml
# ~/.codex/config.toml
[mcp_servers.garden-blog]
url = "https://admin.gardendesk.ai/mcp"
env_http_headers = { "CF-Access-Client-Id" = "GARDEN_ACCESS_CLIENT_ID", "CF-Access-Client-Secret" = "GARDEN_ACCESS_CLIENT_SECRET" }
```

## Prompts, Commands, And Skills

- **Command.** Create `prompts/commands/<name>.md`. Add a short `description:` in the frontmatter and put the instructions in the body. `$ARGUMENTS` inserts the user's request. A command can name an `agent`, or set `workflow:` to a handler under `packages/core/src/commands/` (see `review.md`).
- **Skill.** Create `prompts/skills/<name>/SKILL.md` with `name` and `description` frontmatter. The name must match the directory. An agent's `skills` list picks the skills it uses.
- **Agent.** Agents live in `prompts/agents/*.md`. Their frontmatter sets tools, skills, temperature, and the turn cap.

Core rejects malformed prompts at startup and never loads prompts from selected folders or attachments. Restart `pnpm desktop:dev` after you change a prompt or Core, so the app and Core run the same version.
