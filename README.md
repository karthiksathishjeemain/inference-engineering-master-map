# Inference Engineering Master Map

An interactive learning platform for understanding modern LLM inference from first principles through production systems.

Explore the dependency map, complete the first full learning module, experiment with KV-cache and performance simulators, study inference metrics, and work through debugging scenarios.

## Live site

Production: https://inference-engineering-master-map.vercel.app/

Mirror: https://karthiksathishjeemain.github.io/inference-engineering-master-map/

## Module 1 — Hardware & performance foundations

- Seven progressive lessons covering the system lifecycle, matrix multiplication, GPU execution, memory, data movement, roofline reasoning, and a checkpoint
- Interactive FLOP, arithmetic-intensity, model-fit, transfer-time, and roofline calculators
- GPU memory-hierarchy explorer and continuous-batching timeline
- Five-question mastery checkpoint and a hands-on Transformer profiling project

## Module 2 — Neural network inference

- Seven lessons covering tokenization, the Transformer forward pass, causal attention, MLPs, logits, sampling, and autoregressive generation
- Interactive token/embedding explorer, forward-pass inspector, causal-attention matrix, MLP calculator, sampling controls, and generation loop
- Five-question mastery checkpoint and a project to implement a next-token inference loop without a high-level generation helper

## Topics

- Hardware, compute, memory, and bandwidth
- Transformer inference, prefill, decode, and KV cache
- Runtimes, batching, scheduling, and serving
- Tensor parallelism, quantization, and distributed inference
- Benchmarking, production metrics, debugging, and system design
