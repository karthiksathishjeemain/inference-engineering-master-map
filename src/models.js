// All memory and bandwidth quantities use decimal SI units unless labeled otherwise.
export function matmul(M, K, N, bytes) {
  const flops = 2 * M * K * N;
  const traffic = (M * K + K * N + M * N) * bytes;
  return { flops, traffic, intensity: flops / traffic };
}

export function memoryFit(parametersB, bytes, vramGB, reserveGB) {
  const weights = parametersB * bytes;
  const usable = vramGB - reserveGB;
  if (usable <= 0) return { weights, feasible: false, gpus: null, perGpuWeights: null, free: null };
  const gpus = Math.ceil(weights / usable);
  const perGpuWeights = weights / gpus;
  return { weights, feasible: true, gpus, perGpuWeights, free: usable - perGpuWeights };
}

export function roofline(opsTF, movedTB, peakTFs, bandwidthTBs) {
  const intensity = opsTF / movedTB;
  const ridge = peakTFs / bandwidthTBs;
  const attainable = Math.min(peakTFs, intensity * bandwidthTBs);
  const seconds = Math.max(opsTF / peakTFs, movedTB / bandwidthTBs);
  const bound = Math.abs(intensity - ridge) < 1e-9 ? 'at the ridge point' : intensity < ridge ? 'bandwidth-bound ceiling' : 'compute-bound ceiling';
  return { intensity, ridge, attainable, seconds, bound };
}

export function kvCache(layers, heads, dimension, sequence, batch, bytes, pageSize = 16) {
  const perToken = 2 * layers * heads * dimension * bytes;
  const pages = Math.ceil(sequence / pageSize) * batch;
  return { perToken, pages, logical: perToken * sequence * batch, allocated: perToken * pages * pageSize };
}

export function denseWork(parametersB, prompt, output, batch) {
  // Standard autoregressive generation: prefill logits yield the first output token.
  const decodeSteps = Math.max(0, output - 1);
  return { prefill: 2 * parametersB * 1e9 * prompt * batch, decode: 2 * parametersB * 1e9 * decodeSteps * batch, decodeSteps };
}

export function parallelModel(degree, baselineMs, payloadMB, collectives, bandwidthGBs, latencyUs) {
  // Ideal ring all-reduce: reduce-scatter + all-gather. No overlap or topology contention.
  const collectiveMs = degree === 1 ? 0 : 2 * (degree - 1) * (latencyUs / 1000 + payloadMB / (degree * bandwidthGBs));
  const communicationMs = collectives * collectiveMs;
  const stepMs = baselineMs / degree + communicationMs;
  return { communicationMs, stepMs, speedup: baselineMs / stepMs };
}

export function queueModel(arrivals, outputTokens, outputTokensPerSecond, seconds = 10) {
  const capacity = outputTokensPerSecond / outputTokens;
  const offeredLoad = arrivals / capacity;
  return { capacity, offeredLoad, backlog: Math.max(0, arrivals - capacity) * seconds, regime: arrivals > capacity ? 'Growing backlog' : arrivals === capacity ? 'No spare capacity' : 'Spare capacity' };
}
