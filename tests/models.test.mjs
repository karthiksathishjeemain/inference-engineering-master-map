import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matmul, memoryFit, roofline, kvCache, denseWork, parallelModel, queueModel } from '../src/models.js';

test('GEMM counts multiply-add as two operations and reuse improves intensity', () => {
  assert.equal(matmul(2, 3, 4, 2).flops, 48);
  assert.equal(matmul(2, 3, 4, 2).traffic, 52);
  assert.ok(matmul(32, 4096, 4096, 2).intensity > matmul(1, 4096, 4096, 2).intensity);
});
test('memory ledger balances per rank and rejects reserve >= VRAM', () => {
  assert.deepEqual(memoryFit(7, 2, 80, 8), { weights: 14, feasible: true, gpus: 1, perGpuWeights: 14, free: 58 });
  assert.equal(memoryFit(70, 2, 80, 8).gpus, 2);
  for (const reserve of [16, 32]) assert.equal(memoryFit(7, 2, 16, reserve).feasible, false);
  const m = memoryFit(80, 4, 80, 8);
  assert.equal(m.perGpuWeights + m.free + 8, 80);
});
test('roofline presets share a physical ceiling and time lower bound', () => {
  const p = roofline(120, .5, 300, 3);
  assert.equal(p.intensity, 240); assert.equal(p.ridge, 100); assert.equal(p.seconds, .4); assert.equal(p.attainable, 300);
  const d = roofline(14, 2.8, 300, 3);
  assert.equal(d.intensity, 5); assert.equal(d.attainable, 15); assert.equal(d.seconds, 2.8/3);
  assert.equal(roofline(100,1,300,3).bound, 'at the ridge point');
  for (const ops of [1, 500]) for (const bytes of [.1, 8]) for (const peak of [25,1000]) for (const bw of [.5,8]) {
    const r = roofline(ops,bytes,peak,bw);
    assert.ok(r.attainable <= peak);
    assert.ok(Math.abs(ops/r.seconds-r.attainable)<1e-8);
  }
});
test('KV uses KV heads and rounds each sequence page separately', () => {
  const r=kvCache(32,8,128,4096,8,2);
  assert.equal(r.perToken,131072); assert.equal(r.logical,4294967296); assert.equal(r.pages,2048);
  const partial=kvCache(32,8,128,17,2,2);
  assert.equal(partial.pages,4); assert.equal(partial.allocated,131072*64);
  assert.equal(kvCache(32,8,128,17,2,1).allocated,partial.allocated/2);
});
test('prefill yields the first output so O output tokens need O-1 decode steps', () => {
  assert.equal(denseWork(7,128,1,1).decode,0);
  assert.equal(denseWork(7,128,256,8).decodeSteps,255);
  assert.equal(denseWork(7,128,256,8).prefill,14336000000000);
});
test('TP has no communication at degree one and can be slower than one GPU', () => {
  assert.deepEqual(parallelModel(1,40,4,64,100,5),{communicationMs:0,stepMs:40,speedup:1});
  const p=parallelModel(4,40,4,64,100,5);
  assert.ok(Math.abs(p.communicationMs-5.76)<1e-10);
  assert.ok(parallelModel(8,1,64,160,10,100).speedup<1);
});
test('fluid queue has explicit capacity and does not hide overload', () => {
  assert.deepEqual(queueModel(30,256,5120),{capacity:20,offeredLoad:1.5,backlog:100,regime:'Growing backlog'});
  assert.equal(queueModel(20,256,5120).regime,'No spare capacity');
  assert.equal(queueModel(10,256,5120).backlog,0);
});
