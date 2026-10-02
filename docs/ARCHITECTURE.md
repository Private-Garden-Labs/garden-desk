# Architecture

Garden Desk V1 is released for Apple silicon macOS and Windows 11 x64. It is a local desktop agent: a person picks a folder or attaches files, asks for a result, and gets files back. Earlier plans, decision records, research, and milestone evidence are in Git history (`git show aec683a9:docs/`).

## Layers

```text
Desktop (Tauri v2, React)
  └─ Garden Desk Core (Node.js, TypeScript)
       ├─ Inference worker (private llama.cpp server, OS sandbox)
       └─ Session microVM (no network device)
            /source            selected folder, live and read-only
            /run/attachments   attached files, immutable
            /workspace         128 MiB, persistent, writable
```

- **Desktop.** The Rust host owns only the window, native dialogs, supervision of the exact packaged Core sidecar, and the connection to it. The webview has no shell, process, environment, network, or filesystem access. It handles opaque IDs, never host paths.
- **Core.** Core is the only product authority. It owns folder grants, attachments, sessions, the agent loop, policy, audit, inference, worker supervision, and recovery. The desktop reaches it only over a current-user local connection: a Unix socket on macOS and a protected named pipe on Windows. There is no TCP. Core and the desktop never run as administrator.
- **Inference worker.** This is one resident llama.cpp server on a private Unix socket. macOS confines it with Seatbelt. Windows runs it in a no-capability AppContainer inside a one-process job. It has no tools, network, credentials, or workspace.
- **MicroVM.** Each conversation gets a VM with an immutable root image. The VM has Python, Node.js, `/bin/sh`, BusyBox, and a fixed set of offline libraries, and it cannot install packages. `/workspace` is saved as a content-addressed manifest and restored after eviction or restart. Idle VMs stay in a pool sized from installed RAM.

## Agent

- Prompts live in `prompts/`: agents, commands, skills, and system text. They are packaged, hashed, and verified with the app.
- The main agent has up to 40 turns. Its tools are `bash`, `python`, `node`, `read`, `glob`, `grep`, `list`, `write`, `edit`, `image`, `skill`, `task`, `question`, and `review`. `read` returns numbered text for DOC, DOCX, and PDF through one fixed guest extraction.
- `task` runs one specialist child at a time in the same VM. The specialists are general, explore, matter chronology, contract obligations, document comparison, and financial review.
- `/review` reviews one attached document in a single model call with no tools. `/obligations`, `/reconcile`, and `/expenses` run a specialist directly.
- Packaged skills are prompt-only. A person can also add, edit, or turn off skill files in the workspace `skills/` folder.
- Every file created or changed under `/workspace` during a run is delivered to the user. Open uses a verified temporary copy. Save As uses a native dialog and an atomic Core write, and the webview never sees the destination path.
- Core compacts the conversation at 80 percent of the context. A session summary keeps continuity across runs. After a crash, runs left running are marked failed. Model reasoning is never stored.

## Security Boundary

- The model proposes tool calls. Core validates each call and runs it in the guest. The model never gets host authority.
- Network isolation comes from the VM having no network device, not from matching commands or URLs. Do not add filters inside the VM.
- Selected folders are never writable. Only an explicit Open or Save As crosses back to the host.
- Guest output that enters host state is checked for schema, path, size, and hash.
- There is no telemetry, analytics, or crash reporting. Audit records are local and hash-chained, and leave the machine only by explicit export.
- On Windows, one signed helper elevates once to add the current user to Hyper-V Administrators. The app stays browse-only until the next sign-in. macOS needs no administrator step.
- The packaged app verifies and read-locks its sidecar, helpers, and prompts against a signed resource manifest before it starts them.
- Data at rest relies on the operating-system account and disk encryption.

## Model And Hardware

- The generation model is Ternary Bonsai 2 27B (`PQ2_0`) with its Q8_0 image projector. The encoder is Qwen3-Embedding-0.6B. `assets/models.json` pins each file, and `assets/inference-runtime.json` pins the PrismML llama.cpp fork builds for Metal, CUDA 13.3, and AMD HIP.
- Packages are self-contained, so first launch downloads nothing.
- The context cache is FP16. Core fits the context once to the inference memory budget, between 32K and 128K tokens. The server's reasoning budget is 32,768 tokens. Thinking levels are None, Medium, and Extended.
- A Mac needs at least 16 GiB of memory. The inference budget is 10 GiB below 24 GiB and 16 GiB from 24 GiB up.
- On Windows the worker prefers one dedicated GPU (12 GB minimum), with a budget of up to 16 GiB. Otherwise it uses one integrated GPU with 16 GiB usable and 24 GiB of RAM. Intel graphics are not supported.

## Code Map

```text
packages/shared    versioned contracts (Zod only)
packages/core      workspace catalog, sessions, agent loop, daemon, policy, audit, inference
packages/workers   inference client, microVM launchers, guest agent, guest image
packages/desktop   Tauri and React app, packaging, Windows Hyper-V setup helper
packages/cli       daemon health client
packages/eval      fixtures, platform gates, golden tasks, model comparison
prompts/           agent, command, skill, and system prompts
site/              website, admin, and blog
```

- State is one schema-versioned SQLite catalog, plus immutable content-addressed artifacts and per-session workspace manifests. To change the schema, add the next numbered migration in `packages/core/src/workspace/migrations/`. Never edit an existing one.
- Change these files together: the guest library manifest, `packages/workers/images/agent/capabilities.json`, the guest build recipe, and `compliance/inventory.json`.
- `pnpm check:source` limits each source file to 300 lines. Biome limits each function to 40 lines, cognitive complexity 10, and four parameters.

## Decisions

- Local and offline first: no account, no cloud dependency, no silent cloud fallback, no telemetry.
- Ship a generic file agent first, not a document pipeline.
- Hostile files and agent code run only in the no-network microVM. GPU inference stays host-native inside an OS sandbox.
- Core is TypeScript on Node.js. Rust and Swift own only OS capabilities.
- The desktop is Tauri v2 and React with a thin Rust host. This replaced an earlier Electron plan.
- The model is Ternary Bonsai 2 27B on the PrismML fork. Stock llama.cpp cannot read `PQ2_0`. AMD on Windows uses HIP, not Vulkan.
- Sampling follows the model card: temperature 1 for chat, with greedy decoding only for JSON. There is no separate output token limit.
- Product contracts do not depend on one model family. Each model, runtime, and hardware combination is certified on its own.
- Garden Desk is licensed Apache-2.0. Contributions use a DCO sign-off with no CLA.

## Possible Next Work

None of this is active. Each item needs an owner request.

- Document intelligence: parsing, OCR and layout, retrieval, citations, and deterministic checks.
- Signed offline Knowledge Bundles of reference material.
- Legal, accounting, and medical administration workflow packs chosen from real use.
- An office appliance with accounts, permissions, backup, and audit.
- Managed model downloads through a typed network broker, and Linux support.
