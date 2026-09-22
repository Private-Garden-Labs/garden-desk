# Milestone M3 Status

Updated: 2026-09-19

M3 Offline Dev-Agent Desktop V1 is active. The desktop runs one general-purpose local agent per conversation: a system prompt plus a fixed tool set, executing every file read and every command inside a no-network microVM (a virtual machine with no network interface).

## What M3 Delivers Today

- New chat sessions with folder or explicit file attachments, folder groups, and recent-session paging.
- The agent inspects a selected folder, writes and runs Python or Node.js, runs shell commands, and returns every file it created or changed under `/workspace` as a deliverable. The Generated files list hides the code files it wrote to do the work.
- In-run clarifying questions, cancellation, and session restoration after a restart.
- Concurrent conversations share one resident inference worker inside a RAM-bounded pool of reusable microVMs. Stop and generation timeouts keep a healthy model resident.
- A private, owner-only debugging snapshot for one session, for local troubleshooting.
- A Skills page beside the conversations sidebar. A person adds a Markdown skill file, edits it, turns it off, or removes it; Core keeps those files in the workspace skills folder and reads them at each run.
- A `task` tool that selects a child from packaged definitions. The Folder intake specialist maps current file groups and structures before work across files. Children run one at a time and have separate activity views.

## Security Boundary

- The guest VM has zero network devices, an immutable root image, a live read-only mount of the selected folder at `/source`, and a writable, persistent 128 MiB `/workspace`.

## 2026-09-20 Agent Guest Memory Measurement

Measured on physical Apple silicon with macOS 27.0, the committed `aarch64` agent image, and deterministic guest scripts. No model ran. Each launch read `/proc/meminfo`, ran one Python document workload (openpyxl, python-docx, ReportLab, pypdf, Pillow), ran one Node.js workload, and then filled the workspace. Host memory is the resident size that `vmmap --summary` reports for the helper process.

| Configured guest RAM | Guest `MemTotal` | Guest `MemAvailable` after boot | Host resident | Bounded workload |
| --- | --- | --- | --- | --- |
| 512 MiB | 490 MiB | 309 MiB | not sampled | Python and Node.js pass; fails while collecting a 100 MiB workspace |
| 768 MiB | 748 MiB | not reached | not sampled | fails while collecting a 120 MiB workspace |
| 1024 MiB | 992 MiB | 749 MiB | 426 MiB | passes, including a 120 MiB workspace |
| 4096 MiB (previous) | 3942 MiB | 3676 MiB | 426 MiB | passes |

Two concurrent guests at 1024 MiB both passed the same workload; each used 426 MiB resident on the host.

Findings. The initramfs root holds about 147 MiB of guest RAM permanently, which `Shmem` reports. Host resident memory is the same 426 MiB at 1024 MiB and at 4096 MiB configured, so the configured size is an admission ceiling, not a physical cost. Node.js failed at 512 MiB with `Fatal process out of memory: SegmentedTable::InitializeTable` because the guest set `RLIMIT_AS` from the memory of the virtual machine; V8 reserves address space it never makes resident. The guest process bound is now the separate `AGENT_GUEST_ADDRESS_SPACE_BYTES` (4 GiB, the value the guest received before), and the memory of the virtual machine is 1 GiB. A read-only Squashfs root was evaluated and not adopted: 1024 MiB already runs the bounded workload with the present initramfs, and a disk root needs a new guest image, new manifest hashes, and both native helpers. Peak use: Python 66 MiB, Node.js 65 MiB.
- Garden Desk Core owns every host filesystem, process, and audit decision; the webview and the model never receive host authority.
- Crash recovery marks any run left `queued` or `running` after a Core restart as failed. Session summaries and context compaction keep long conversations coherent without extending the live prompt indefinitely.

## What Remains Open

- Blind qualified-reviewer check of the professional review skills' outputs (legal, finance, medical administration) on both platforms before public release.
- Packaged Open and Save As for generated files, observed on the built macOS and Windows applications.
- Windows setup certified under a dedicated standard-user account (current evidence used an administrator account with UAC filtering).
- Windows release signing: Authenticode signing under the production certificate, covering the inference runtime files as well as the sidecar and the helpers. Smart App Control blocks the unsigned runtime, so this is required to run, not only to ship. The macOS release is signed with a Developer ID certificate and notarized; set `APPLE_SIGNING_IDENTITY` and the `APPLE_API_*` variables to reproduce that build.

## 2026-09-03 Windows Gate Result

The run used physical Windows x64 after `git fetch origin main`. The checked base commit was the current `origin/main` tip, `6ffb71b`. The first run found that the x86-64 root-image hash in the manifest was stale after the product-name change.

- `pnpm guest:build:agent:windows` passed after the manifest fix. The two independent builds were byte-for-byte equal. The kernel SHA-256 was `9fabee42a89b8128aa9f16dee4d43289c113f8b2aea398cabc904b6911a41dea`. The root-image SHA-256 was `452478a3997469786ebfe14471da2983b5417f3033089d6c5ca513c1c65a7b63`.
- `pnpm desktop:build-sidecar` passed and recorded the same two image hashes.
- `pnpm test:m3:windows` passed the guest boundary checks and all four golden tasks: XLSX extraction, DOCX extraction, PDF extraction, and the mixed-folder report. It printed `golden: 4/4 passed`.

This result passed the Windows headless M3 gate for the checked revision. It does not cover the Qwen3.8 migration in [ADR 0019](adr/0019-qwen38-private-server.md). The other open release items remain separate.

## 2026-09-07 Qwen3.8 Migration Checks

At `f6c7b6d`, bounded Mac checks passed on an M5 Pro with 48 GiB and macOS 26.6.2, using b10816 Metal, Q4 weights, 32K context, and Q8/Q8 context caches. The run processed 30,061 input tokens in 116.4 seconds and generated 154 tokens at 14.6 tokens/s. Cache reuse, cancellation, image inspection, and a physical microVM folder report passed. All run processes stopped. The highest sampled resident memory was 14.73 GiB; this is a sampled maximum, not proof of the absence of paging. The separate encoder check returned 1,024 values.

[PR #110](https://github.com/private-garden-labs/garden-desk/pull/110) contains the measurements and earlier bounded Windows results on an RTX 5070 Ti. These checks meet the migration requirement in ADR 0019. They do not certify other hardware, the full M3 gate, the desktop UI, or production signed packages for this migration.

## 2026-09-18 Ternary Bonsai 2 Candidate

[ADR 0020](adr/0020-ternary-bonsai-2-prism-fork.md) moves the generation model to Ternary-Bonsai-2-27B `PQ2_0` on the PrismML llama.cpp fork `prism-b10709-9a9394a`. One approved smoke check ran on Windows with an RTX 5070 Ti (16 GiB) and the product server arguments at 32K context with Q4/Q4 context caches. The model loaded in 7.6 seconds. The server reported 6,861.74 MiB of GPU weights, a 576 MiB KV cache, a 149.62 MiB recurrent-state buffer, and a 189.27 MiB compute buffer. A plain question answered correctly at 62.3 tokens/s. A request with a `read_file` tool returned one well-formed tool call with the right path at 888 tokens/s prefill and 62.0 tokens/s generation. A game process held GPU memory during this check, so these numbers are not the comparison. That Windows check ran on the earlier release `prism-b10685-7dffb15`.

The full comparison against Qwen3.8 27B Q4 (`pnpm model:compare`, `pnpm model:compare:agent`, `pnpm model:compare:report`) is pending an owner run. Bonsai 2 has no dspark drafter, so the speculative comparison uses the server's n-gram self-speculation (`ngram-mod`). The MLX 2-bit release is a Mac measurement target only. The context is now fitted to the memory budget (ADR 0020): 262,144 tokens on this Windows machine and 208,896 tokens on Mac. The Windows fitted size is unverified in a real run; the Mac run below loaded the fitted size.

## 2026-09-19 Ternary Bonsai 2 On Apple Silicon

`pnpm model:compare` ran once on physical Apple silicon with macOS 27.0, the pinned fork Metal archive, the product server arguments, no speculation, and Q8/Q8 context caches. The model loaded at the minimum context and at the fitted Mac context, and the server answered every request.

| Context | Load | GPU | CPU |
| --- | --- | --- | --- |
| 32,768 tokens | 14.3 s | 8.11 GiB | 0.02 GiB |
| 208,896 tokens (fitted) | 15.0 s | 14.58 GiB | 0.11 GiB |

At 32,768 tokens, a 24,816-token prompt filled at 111.7 tokens/s. Generation gave 23.3 tokens/s for code, 22.8 tokens/s for prose, and 24.1 tokens/s for code with thinking on. Tool-call precision was 9 of 11 and specialist choice was 6 of 12. The result file is `packages/eval/.generated/model-comparison/bonsai2-mac-metal.json`.

This run measures the new model alone on one machine. The Qwen3.8 27B Q4 comparison, the Windows measurements, the Windows agent stage, the MLX 2-bit measurement, and the full macOS gate stay open.

## 2026-09-20 Ternary Bonsai 2 On Windows NVIDIA

One run on physical Windows 11 (build 26200) with an AMD Ryzen 9 7945HX, 33,511,849,984 bytes of installed memory, and an NVIDIA GeForce RTX 4080 Laptop GPU on driver 32.0.15.5597. The pinned fork `windows-cuda-x64` archive reported `CUDA0: NVIDIA GeForce RTX 4080 Laptop GPU (12281 MiB, 11063 MiB free)`.

The memory policy and the context rule ran on those probe numbers through the product functions. Detected memory was 12,877,561,856 bytes, above the 10 GB dedicated threshold. Usable memory was 11,600,396,288 bytes, and the budget followed it rather than the total, below the 16 GiB cap. The host reservation was 20 GiB. With Q4/Q4 caches and the 7,206,168,928-byte model, the fitted context was 90,112 tokens.

The server loaded that context in 3.4 seconds and answered. It reported 6,861.74 MiB of GPU weights, a 1,584.00 MiB KV cache, a 149.62 MiB recurrent-state buffer, and a 441.27 MiB compute buffer, with 49.27 MiB of host compute and 0.95 MiB of host output. GPU allocation totalled about 9,036 MiB inside the 11,063 MiB the device reported free. A short request generated 13 tokens at 31.7 tokens/s after an 81.6 tokens/s prefill. The budget that follows usable memory did not select a context that fails to load.

This run started `llama-server.exe` directly, because the machine has no Rust toolchain and therefore no AppContainer launcher. Device selection through `resolveWindowsGpuProfile`, the isolated per-device probes, the guest stages, and the stress comparison stay unverified.

## 2026-09-21 Windows Build Chain

After installing the Visual Studio Build Tools, Rust, Python, WSL2, and Docker on the same machine, `pnpm guest:build:agent:windows` produced a byte-identical guest image: the kernel SHA-256 was `9fabee42a89b8128aa9f16dee4d43289c113f8b2aea398cabc904b6911a41dea` and the root image `a7e3558b945b09b4d437d1aa6d97cb8206c3b417e512badb84ff0deee8f33e87`, both matching the committed manifest. All four Windows native helpers built and signed.

`pnpm desktop:build-sidecar` then staged the packaged resources and signed the eleven fork-built runtime files in each backend directory, leaving the NVIDIA, AMD, and Microsoft redistributables on their own signatures.

Two stages stay unverified on this machine. `pnpm verify` stops in the Rust stage because Smart App Control blocks the build script that Cargo compiles for `wry`, reported as `An Application Control policy has blocked this file. (os error 4551)`; every other stage of `pnpm verify` passed, including 513 unit tests. `pnpm test:m3:windows` and the stress comparison need the Hyper-V Administrators membership that the setup step adds, and a Windows sign-out has not yet applied it to the session token.

## 2026-09-20 Windows Code Integrity Blocks The Unsigned Runtime

Smart App Control was enforcing on this machine (`VerifiedAndReputablePolicyState` 1). It stopped `llama-server.exe` with exit code `0xC0E90002` and no output. CodeIntegrity events 3077 and 3033 named `mtmd.dll` as the file that did not meet the signing requirement.

Eleven files in each Windows archive carry no signature: `llama-server.exe`, `llama-server-impl.dll`, `llama-fit-params-impl.dll`, `llama.dll`, `llama-common.dll`, `mtmd.dll`, `ggml.dll`, `ggml-base.dll`, `ggml-cpu.dll`, `ggml-rpc.dll`, and the backend `ggml-cuda.dll` or `ggml-hip.dll`. The NVIDIA, AMD, and Microsoft redistributables beside them are already signed.

Signing those eleven files with an Authenticode signature lets them load, including a self-signed certificate whose chain is not trusted. An unsigned copy of the same directory still failed, and neither copy carried a download zone marker, so the signature is what changed the outcome. Mainline llama.cpp `b10816` is equally unsigned and runs on the same machine, so reputation covers it and a fork build has none. The macOS package already signs each runtime file through `signRuntimeFile`; the Windows package does not. Signing the Windows runtime is open release work.

## 2026-09-20 Windows AMD HIP Is Unsupported On This Machine

The `windows-hip-x64` runtime started after signing and reported no devices. `ggml-hip.dll` cannot load at all: it imports `amdhip64_7.dll`, and this system has only `amdhip64.dll`. The integrated adapter is an AMD Radeon 610M, which is gfx1036 and outside the compiled list in [ADR 0020](adr/0020-ternary-bonsai-2-prism-fork.md). A current Adrenalin driver could supply the missing file; the unsupported architecture stands regardless. HIP has no measurement on this hardware.

## Running The Golden Tasks

`pnpm test:m3:macos` and `pnpm test:m3:windows` run the guest security probes (no network interface, read-only `/source`, cancellation, resource limits, persistence), then four golden folder tasks — XLSX extraction, DOCX extraction, PDF extraction, and a mixed-folder report — each through one real agent run, checked deterministically against known fixture values. They print `golden: N/4 passed` and exit non-zero if any task fails. There is no separate readiness record or result classification beyond that count.
