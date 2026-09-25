# Content and behavior review — 25 September 2026

## Production scope

Module 1 has seven lessons and a self-study checkpoint. The map has 13 topics; topics 2–13 and the later project ideas are a roadmap. Module 2 is not included in the current production HTML or JavaScript. Its earlier implementation remains in Git history.

## Corrections

- Removed invented TTFT/TPOT regressions from the system tour. It now reports explicit dense-projection work (2 × parameters × tokens), excluding attention and serving overhead.
- Rebuilt the roofline with a shared logarithmic coordinate system for the curve, ridge, and workload ceiling. Labels distinguish an upper performance ceiling from a lower time bound and from measured performance.
- Corrected ordinary autoregressive generation: prefill yields logits for output token one; O outputs require O−1 subsequent decode passes. Removed bottleneck classification from a prompt/output-length ratio.
- Corrected the KV budget to 62 GB (80−14−4), show uncapped allocated bytes on overflow, and round page allocation per sequence. Scope includes full attention and KV heads, not all query heads; MLA and sliding windows need other accounting.
- Reject memory plans with per-GPU reserve greater than or equal to VRAM. GPU counts are explicitly ideal lower bounds, not valid TP deployment plans.
- Quantization estimates describe raw weight payload only, with metadata, unsupported paths, quality, and runtime exclusions. Storage reduction is not a speedup guarantee.
- Replaced arbitrary TP efficiency coefficients with an explicit ring all-reduce model. Degree one incurs zero communication; high latency or payload can cause speedup below 1×. Real topology, overlap, head divisibility, replicated KV, and kernel efficiency remain outside the model.
- Replaced invented scheduling policy multipliers and p99 predictions with a fluid offered-load model using an explicit sustained output rate. Below-capacity traffic is not asserted to have zero waiting or meet an SLO.
- Clarified TTFT boundaries, TPOT denominator/one-token requests, chunk-vs-token ITL, throughput populations, SM activity versus occupancy, and MFU units.
- Fixed the memory debug case: 140 GB weights + 180 GB KV + 20 GB runtime exceeds four 80 GB devices. Mark diagnoses as hypotheses requiring measurement. Batching advice now distinguishes throughput from per-request latency.
- Added model.eval(), inference-mode distinction, warmup and CUDA synchronization to the profiling project.
- Removed “learning mode” buttons that only changed headings without changing their content. Added sources, roadmap status, browser-local progress, semantic buttons, and lesson URLs.
- Replaced the conversation export/iframe with a normal static website. The source, build, and analytics integration are now in the repository; no Codex installation or CDN is required to build or run the educational UI.

## Primary references checked

- [NVIDIA GPU performance background](https://docs.nvidia.com/deeplearning/performance/dl-performance-gpu-background/index.html)
- [NVIDIA matrix multiplication](https://docs.nvidia.com/deeplearning/performance/dl-performance-matrix-multiplication/index.html)
- [PyTorch CUDA semantics](https://docs.pytorch.org/docs/stable/notes/cuda.html)
- [PyTorch inference mode](https://docs.pytorch.org/docs/stable/generated/torch.autograd.grad_mode.inference_mode.html)
- [Hugging Face cache strategies](https://huggingface.co/docs/transformers/main/en/kv_cache)
- [vLLM metric definitions](https://docs.vllm.ai/en/latest/design/metrics/)
- [PagedAttention paper](https://arxiv.org/abs/2309.06180)
- [NCCL collective semantics](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
- [TGI maintenance status](https://huggingface.co/docs/text-generation-inference/en/index)

## Validation and limits

`npm test` passed seven groups covering calculator results, reserve overflow, page rounding, decode counts, ridge equality, zero-communication TP, slow TP, and queue overload. `npm run test:browser` passed 85 view/width combinations at 320/375/768/1024/1440px, interactions, browser Back, persistence, blocked storage, dark mode, and browser-error checks. The 34 axe scans (17 views × light/dark at 375px) returned no violations under the WCAG 2 A/AA and 2.1 AA rules tested. Automated scans do not constitute a complete accessibility certification.

These checks validate the educational implementation. They do not validate a particular GPU/engine deployment, model-quality tradeoff, or capstone SLO. The resource is not a complete 13-module course and does not claim independent expert certification.
