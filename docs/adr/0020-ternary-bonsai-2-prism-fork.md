# ADR 0020: Ternary Bonsai 2 27B and the PrismML llama.cpp fork

Status: owner-approved candidate. Bounded Windows checks are in progress; see [current status](../M3_STATUS.md). This decision replaces the generation model, the image projector, and the runtime build in [ADR 0019](0019-qwen38-private-server.md). The private socket transport, the memory profiles, the context policy, the reasoning rules, and the embedding encoder from ADR 0019 stay in effect.

Use Ternary-Bonsai-2-27B `PQ2_0` (7.21 GB, 2.13 bits per weight) and its Q8_0 image projector on both platforms. Prism ML built the model from Qwen3.8-27B, so the chat template, the tool-call format, the thinking control, and the 262,144-token training context are the same. The model is Apache-2.0. The managed catalog pins each file, revision, size, and hash.

Use the PrismML fork of llama.cpp, release `prism-b10685-7dffb15`, for all inference. Stock llama.cpp cannot read the `PQ2_0` tensors. The fork ships prebuilt macOS Metal, Windows CUDA 13.3, and Windows Vulkan archives. The manifest pins each archive hash. The Windows CUDA archive keeps the CUDA 13.3 runtime and Visual C++ dependencies from before; it no longer needs the LLVM OpenMP runtime. The fork prints the memory report lines at log verbosity 4, so the server runs at that verbosity.

Speculative decoding: Bonsai 2 ships no dspark drafter, and the GGUF file has no multi-token prediction head. The server supports n-gram self-speculation (`--spec-type ngram-mod`), which needs no extra model and no extra memory. The profile constant `speculation` selects `none` or `ngram-mod` for generation servers. The default stays `none` until the comparison in the M3 status shows a gain on the agent workload.

The context stays at 32,768 tokens until the comparison reports the memory at larger contexts. With 6.86 GiB of weights and 576 MiB of context cache at 32K tokens, the 16 GiB budget has room for a larger context; a change to the context is a separate owner decision.

The MLX 2-bit release of the same model is a text-only Apple Silicon package with its own Python runtime. It does not run behind the private llama-server socket. It is a measurement target only: run it with the Prism demo server and pass `--url` to `pnpm model:compare`. A product decision on MLX needs a new ADR.
