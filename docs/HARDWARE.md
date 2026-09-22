# Hardware

Created: 2026-07-10

Garden Desk should avoid manufacturing hardware initially. The product should own the software, workflows, customer experience, validation process, and support relationship while using OEMs or specialist builders for assembly, warranty, shipping, and replacement.

## Hardware Principles

- Market capabilities and supported workloads, not VRAM or parameter counts.
- Keep the community platform hardware-agnostic.
- Certify a small number of configurations.
- Classify all other hardware honestly.
- Avoid large inventory.
- Separate manufacturer warranty from Garden Desk support.
- Treat performance guarantees as a product feature.

## Hardware Classes

### Certified

Tested by Garden Desk for specific model profiles and workflows.

Certified hardware should include:

- Known CPU, GPU, memory, storage, and OS configuration.
- Validated local inference runtime.
- Benchmark result.
- Supported workflow list.
- Support eligibility.
- Recovery path.

### Compatible

Expected to work based on specs and runtime support, but not fully validated for a support guarantee.

### Experimental

May work for technical users. No guarantee and limited support.

## Community Target

Current community targets follow [ADR 0019](adr/0019-qwen38-private-server.md) and [ADR 0020](adr/0020-ternary-bonsai-2-prism-fork.md).

- Mac: at least 16 GiB installed memory. Below 24 GiB the inference budget is 10 GiB; at 24 GiB and above it stays 16 GiB. Reserve 4 GiB for the host and 1 GiB per microVM.
- Windows with a dedicated GPU: at least 12 GB of GPU memory and 28 GiB installed memory. The inference budget follows the memory the runtime reports as usable on that GPU, up to 16 GiB. That usable memory must hold the model, the smallest supported context, and the margin: 10,444,171,616 bytes. A 10 GB card keeps less than this after the Windows desktop takes its part of the memory. Reserve 20 GiB for inference, 4 GiB for the host, and 1 GiB per microVM.
- Windows with an integrated GPU: unchanged. At least 16 GiB usable GPU allocation and 24 GiB installed memory. CUDA and HIP retain device identity and isolation checks.
- Windows graphics: NVIDIA through CUDA, and AMD Radeon RDNA 2, RDNA 3, and RDNA 4 through HIP. The HIP runtime needs `amdhip64_7.dll` from a current AMD Adrenalin driver. Tested hardware is listed in [M3_STATUS.md](M3_STATUS.md); every other card is expected compatibility, not verified.
- Generation: Ternary Bonsai 2 27B, an FP16 context cache, and a context fitted once to the inference budget above (32K to 128K tokens), all weights and context state on one GPU. No runtime fitting or CPU fallback.
- Windows agent execution requires Pro or Enterprise with Hyper-V enabled. The setup helper only adds the requesting user to Hyper-V Administrators.

macOS and Windows are verified; [M3_STATUS.md](M3_STATUS.md) records the evidence and the machines. Memory admission is not certification: a Mac or a graphics card that the status does not name is expected compatibility.

## Personal Computer Target

Initial personal systems should be standard Windows desktops or mini-PCs with high memory and validated local runtimes.

They should:

- Work as ordinary computers.
- Include Garden Desk and validated models.
- Be encrypted and recoverable.
- Ship with benchmarked performance.
- Default automatically to the validated bundled model. If a build includes multiple approved models, expose only those installed choices; a single-model build shows static model text with no selector.

Potential strategic fit:

- AMD high-memory unified-memory systems for compact personal or office boxes.
- NVIDIA systems for higher throughput office deployments.

## Office Appliance Target

Office appliances should be sized by workloads:

- Simultaneous users.
- Documents processed per hour.
- Maximum supported document sets.
- Expected report-generation time.
- Workflow packs enabled.
- Backup and storage needs.

Possible configurations:

- Compact AMD unified-memory mini workstation.
- NVIDIA GPU workstation for higher throughput.
- Larger NVIDIA appliance class for bigger models and concurrency.
- Later multi-node setups.

Current appliance stance:

- Do not choose a 64 GB default SKU before the automatic desktop tiers are validated.
- Treat Gemma 4 12B QAT with larger context and concurrency as the conservative later appliance baseline.
- Treat Gemma 4 31B dense QAT and Gemma 4 26B A4B QAT as later research candidates.
- Do not let larger-model appliance work change the desktop architecture.

The first office appliance should benchmark from real workflow demand, not from model-size appeal.

## Runtime Implications

Planned first-choice runtime directions:

- Apple Silicon: the pinned llama.cpp fork server through Metal with Ternary Bonsai 2 first; MLX-family serving is a later adapter-backed optimization candidate.
- Windows: one package contains CUDA and HIP. The worker probes both and uses one adapter that it can map and isolate. CUDA has priority over HIP only for the same adapter. The user supplies a compatible display driver, not a separate Garden Desk installation.
- Shared appliance or Linux server: vLLM-class serving only after the automatic desktop tiers are validated and appliance profiles are re-opened.
- NVIDIA-specific optimization: later, after exact model support is proven.

Runtime certification must include the model format, quantization type, maximum stable active context, KV-cache behavior, multimodal behavior, and document-worker memory overhead.

Every automatic memory tier must also pass context-compaction stability. A configuration is not certified if it works only until the first context window fills.

## Benchmark Strategy

Benchmarks should measure:

- First-token latency.
- Inter-token latency.
- Tokens per second.
- End-to-end workflow latency.
- Peak VRAM and RAM.
- Indexing throughput.
- OCR throughput.
- Retrieval recall and citation precision.
- Tool-loop success rate.
- Crash and recovery behavior.
- Claim verification failure rate.
- Folder-level summary coverage.
- Large-folder resumability.
- Stable multi-compaction behavior over long folder sessions.

Tokens per second alone is not a product benchmark.

## Partnership Ladder

Recommended sequence:

1. Join vendor developer programs.
2. Request evaluation hardware and engineering contacts.
3. Build measurable workflow demonstrations.
4. Run small professional-office pilots.
5. Request pilot hardware, co-marketing, and OEM introductions.
6. Demonstrate that Garden Desk creates hardware demand.
7. Discuss strategic investment after traction.

Avoid company-wide exclusivity. Vendor-specific SKUs are acceptable, but the community product should remain hardware-agnostic.
