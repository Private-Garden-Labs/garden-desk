# Garden Desk

**Private work should stay private.**

Garden Desk is a free desktop agent for work with local files. Choose a folder or attach files, describe the result you need, and review what it makes. It runs on your computer with no account, telemetry, or cloud service.

## How it works

```text
Desktop (Tauri and React)
  └─ Garden Desk Core (TypeScript and Node.js)
       ├─ Supervised local model (Ternary Bonsai 2 27B)
       └─ No-network microVM (virtual machine with no network device)
            /source: selected folder, read-only
            /workspace: private working files
```

Core controls folder access, approvals, audit, and recovery. The model proposes work; Core runs file tools and code in the microVM. The selected folder stays read-only. You choose where to save results.

## Get Garden Desk

Download signed builds for [Apple silicon macOS or Windows 11 x64](https://gardendesk.ai/releases/). Windows needs Pro or Enterprise with Hyper-V enabled. First launch needs no download. To build from source, use the [development workflow](docs/DEVELOPMENT_WORKFLOW.md#local-source-setup).

## Benchmark

In a development comparison on 2026-09-23, local Bonsai 2 27B, Qwen3.8 27B, and Qwen3.8 Max each passed 18 of 18 tasks. See the [tasks, times, and tool errors](https://github.com/Private-Garden-Labs/garden-desk/issues/168). This result applies to that suite.

## Learn more

Read the [architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY.md), [current status](docs/M3_STATUS.md), and [license](LICENSE). See the [website and demo](https://gardendesk.ai/).

## Supporters

Every feature stays free for everyone.

**Company sponsors:** none yet.

**Sponsors:** none yet.

See the [supporters page](https://gardendesk.ai/supporters/) or [support the work](https://github.com/sponsors/Private-Garden-Labs).
