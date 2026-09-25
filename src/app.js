import { matmul, memoryFit, roofline, kvCache, denseWork, parallelModel, queueModel } from './models.js';

(() => {
  const root = document.getElementById('iem-platform');
  if (!root) return;
  const iemOne = (s, n = root) => n.querySelector(s);
  const iemAll = (s, n = root) => Array.from(n.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmtBytes = (bytes) => {
    const units = ['B','KB','MB','GB','TB']; let v = bytes; let i = 0;
    while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
  };
  const fmt = (v, digits = 1) => Number(v).toLocaleString(undefined, {maximumFractionDigits: digits});

  const storageKey = 'inference-foundations-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  let activeView = 'map';
  function saveProgress() {
    try { localStorage.setItem(storageKey, JSON.stringify({ lesson: activeLesson, solved: [...quizSolved], complete: moduleComplete })); } catch {}
  }
  let applyingRoute = false;
  function setRoute(route) {
    if (!applyingRoute && location.hash !== '#' + route) history.pushState(null, '', '#' + route);
  }
  function setProgress(value, total, label) {
    const bar = iemOne('.iem-progress-shell');
    bar.setAttribute('aria-label', label); bar.setAttribute('aria-valuemax', total); bar.setAttribute('aria-valuenow', value);
    iemOne('#iem-progress-fill').style.width = `${value / total * 100}%`;
  }

  const layers = [
    {name:'Foundations', difficulty:'Foundation', why:'The resource model underneath every inference decision: compute, memory, movement, latency, and concurrency.', prereq:'Python, tensors, basic systems', question:'Where do time and bytes go?', unlocks:'Transformer execution', topics:['GPU/CPU','FLOPs','bandwidth','latency','PCIe','NUMA','precision']},
    {name:'Neural inference', difficulty:'Foundation', why:'Turns a model definition into a forward pass, logits, and an autoregressive loop.', prereq:'Foundations + linear algebra', question:'What computation predicts one token?', unlocks:'Prefill and decode', topics:['forward pass','attention','MLP','logits','softmax','tokenization']},
    {name:'LLM internals', difficulty:'Core', why:'Separates prompt processing from token generation and exposes their different performance regimes.', prereq:'Transformer forward pass', question:'Why do prefill and decode behave differently?', unlocks:'KV engineering + roofline', topics:['prefill','decode','KV cache','arithmetic intensity','roofline']},
    {name:'Inference runtime', difficulty:'Core', why:'Maps tensor operations to kernels, graphs, allocators, compilers, and device execution.', prereq:'GPU + LLM internals', question:'How does an op become GPU work?', unlocks:'Kernel optimization', topics:['loading','kernels','fusion','CUDA graphs','compilation','memory pools']},
    {name:'Serving', difficulty:'Core', why:'Coordinates many independent users over a finite token and memory budget.', prereq:'Runtime + latency metrics', question:'Which request runs next?', unlocks:'Schedulers + production SLOs', topics:['queues','continuous batching','streaming','backpressure','admission']},
    {name:'Parallelism', difficulty:'Advanced', why:'Splits model work across devices when one accelerator is insufficient or too slow.', prereq:'Tensor shapes + collectives', question:'What is split, and what must communicate?', unlocks:'Distributed inference', topics:['TP','PP','DP','EP','CP','all-reduce','all-gather']},
    {name:'KV cache engineering', difficulty:'Advanced', why:'Makes autoregressive reuse practical while controlling fragmentation, eviction, and memory pressure.', prereq:'Attention + serving', question:'How is history stored and scheduled?', unlocks:'Long context + prefix reuse', topics:['layout','pages','blocks','prefix cache','eviction','fragmentation']},
    {name:'Quantization', difficulty:'Advanced', why:'Trades representation fidelity for lower memory traffic, smaller capacity needs, and supported low-precision compute.', prereq:'Precision + kernels', question:'Which tensors can lose bits safely?', unlocks:'Cost/performance tuning', topics:['BF16','FP8','INT8','INT4','calibration','KV quantization']},
    {name:'Advanced decoding', difficulty:'Advanced', why:'Changes how candidate tokens are produced and verified to reduce serial decode cost or control output.', prereq:'Autoregressive decode', question:'Can we accept more than one token per expensive step?', unlocks:'Speculation + structured generation', topics:['sampling','beam','draft models','Medusa','rejection','acceptance']},
    {name:'Distributed inference', difficulty:'Expert', why:'Combines topology, collectives, placement, and synchronization across GPUs and nodes.', prereq:'Parallelism + networking', question:'When does communication erase compute gains?', unlocks:'Multi-node production', topics:['NVLink','PCIe','InfiniBand','Ethernet','topology','faults']},
    {name:'Optimization', difficulty:'Expert', why:'Chooses the highest-leverage change after identifying the actual limiting resource.', prereq:'Profiling across all layers', question:'What is the bottleneck now?', unlocks:'Reliable performance work', topics:['fusion','graphs','batching','caching','scheduling','memory']},
    {name:'Production serving', difficulty:'Expert', why:'Maintains SLOs through variable load, releases, failures, and cost constraints.', prereq:'Serving + distributed systems', question:'How does performance remain reliable?', unlocks:'Platform architecture', topics:['autoscaling','SLOs','p99','rollouts','observability','fault tolerance']},
    {name:'Frameworks', difficulty:'Applied', why:'Connects principles to serving engines, execution libraries, and compilers. These tools occupy different parts of the stack; they are not interchangeable servers.', prereq:'All prior layers', question:'Which engine fits this workload?', unlocks:'Informed deployment choices', topics:['vLLM','TensorRT-LLM','SGLang','TGI (maintenance)','llama.cpp','DeepSpeed-Inference','TorchInductor (compiler)']}
  ];

  const layerList = iemOne('#iem-layer-list');
  layers.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `btn iem-layer${i === 0 ? ' is-selected' : ''}`; b.dataset.layer = i; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.innerHTML = `<span class="iem-layer-num">${String(i + 1).padStart(2,'0')}</span><span>${l.name}</span><span class="iem-layer-state">${i < 1 ? '●' : '○'}</span>`;
    layerList.appendChild(b);
  });
  let selectedLayer = 0;
  function showLayer(i) {
    selectedLayer = i;
    const l = layers[i];
    iemAll('.iem-layer').forEach((b, j) => { b.classList.toggle('is-selected', j === i); b.setAttribute('aria-pressed', j === i ? 'true':'false'); });
    iemOne('#iem-layer-number').textContent = `LAYER ${i + 1}`; iemOne('#iem-layer-title').textContent = l.name; iemOne('#iem-layer-difficulty').textContent = l.difficulty;
    iemOne('#iem-layer-why').textContent = l.why; iemOne('#iem-layer-prereq').textContent = l.prereq; iemOne('#iem-layer-question').textContent = l.question; iemOne('#iem-layer-unlocks').textContent = l.unlocks;
    iemOne('#iem-layer-topics').innerHTML = l.topics.map(t => `<span class="iem-chip">${t}</span>`).join('');
    const moduleButton = iemOne('#iem-enter-module');
    moduleButton.textContent = i === 0 ? 'Open full Module 1' : 'Module not available yet';
    moduleButton.disabled = i !== 0;
    if (activeView === 'map') setRoute('map/' + (i + 1));
  }
  layerList.addEventListener('click', e => { const b = e.target.closest('[data-layer]'); if (b) showLayer(+b.dataset.layer); });

  let activeLesson = Number.isInteger(saved.lesson) ? clamp(saved.lesson, 0, 6) : 0;
  let moduleComplete = false;
  function switchView(name) {
    if (!['map','module','sim','metrics','labs','curriculum','sources'].includes(name)) name = 'map';
    activeView = name;
    setRoute(name === 'module' ? 'module/' + (activeLesson + 1) : name === 'map' ? 'map/' + (selectedLayer+1) : name);
    iemAll('[data-view]').forEach(b => { const on = b.dataset.view === name; b.classList.toggle('btn-primary', on); b.setAttribute('aria-pressed', on ? 'true':'false'); });
    iemAll('[data-panel]').forEach(p => p.classList.toggle('is-active', p.dataset.panel === name));
    if (name === 'module') showLesson(activeLesson);
    else {
      setProgress(1, 13, 'Published modules');
      iemOne('#iem-progress-label').textContent = name === 'map' ? '1 module available · 12 topics on the roadmap' : 'Module 1 available · supporting resources';
    }
  }
  iemAll('[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  iemOne('#iem-enter-module').addEventListener('click', () => { if (selectedLayer === 0) switchView('module'); });

  const flowData = [
    {title:'Request', icon:'send', resource:'CPU · network', why:'Defines prompt, sampling, limits, and deadline.', watch:'arrival rate · payload · deadline', fail:'bursts overwhelm admission'},
    {title:'Tokenizer', icon:'binary', resource:'CPU · memory', why:'Converts text into model vocabulary IDs.', watch:'tokens/s · prompt length', fail:'CPU stalls GPU feed'},
    {title:'Queue', icon:'list-ordered', resource:'Host memory', why:'Buffers demand until capacity is admitted.', watch:'queue time · depth · age', fail:'tail latency explodes'},
    {title:'Scheduler', icon:'calendar-clock', resource:'CPU · policy', why:'Packs token work under compute and KV budgets.', watch:'batch tokens · preemption', fail:'head-of-line blocking'},
    {title:'Prefill', icon:'layers', resource:'GPU compute + memory', why:'Processes prompt tokens, builds KV state, and produces logits for the first output token.', watch:'TTFT · FLOPs · batch tokens', fail:'long prompts monopolize steps'},
    {title:'KV cache', icon:'database', resource:'GPU memory', why:'Stores K/V tensors so history is not recomputed.', watch:'blocks · hit rate · fragmentation', fail:'allocation or eviction thrash'},
    {title:'Decode', icon:'repeat-2', resource:'GPU memory + compute', why:'Processes newly selected tokens with cached history. Small batches often have low arithmetic intensity.', watch:'TPOT · active sequences · KV reads', fail:'weight/KV traffic or overhead dominates'},
    {title:'Stream', icon:'radio', resource:'CPU · network', why:'Returns tokens before generation completes.', watch:'flush delay · disconnects', fail:'backpressure pins resources'},
    {title:'Observe', icon:'activity', resource:'Telemetry', why:'Closes the loop between SLO symptoms and resources.', watch:'p50/p95/p99 · traces', fail:'averages hide tail pain'}
  ];
  const flow = iemOne('#iem-flow');
  flowData.forEach((n, i) => {
    const b = document.createElement('button'); b.type='button'; b.className=`iem-flow-node${i===0?' is-active':''}`; b.dataset.node=i; b.setAttribute('aria-pressed', i===0?'true':'false');
    b.innerHTML = `<span class="iem-flow-index">${String(i+1).padStart(2,'0')}</span><span>${n.title}</span>`; flow.appendChild(b);
  });
  function showNode(i) { const n=flowData[i]; iemAll('.iem-flow-node').forEach((b,j)=>{b.classList.toggle('is-active',j===i);b.setAttribute('aria-pressed',j===i?'true':'false');}); iemOne('#iem-node-stage').textContent=`STAGE ${i+1}`; iemOne('#iem-node-title').textContent=n.title; iemOne('#iem-node-resource').textContent=n.resource; iemOne('#iem-node-why').textContent=n.why; iemOne('#iem-node-watch').textContent=n.watch; iemOne('#iem-node-fail').textContent=n.fail; }
  flow.addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b)showNode(+b.dataset.node);});
  showNode(0);

  const lanes = [
    {name:'Request A', phases:['prefill','prefill','decode','decode','decode','decode','decode','','','','','']},
    {name:'Request B', phases:['','','prefill','prefill','decode','decode','decode','decode','decode','','','']},
    {name:'Request C', phases:['','','','','prefill','decode','decode','decode','decode','decode','decode','']}
  ];
  let tick=0;
  function renderTimeline(){
    iemOne('#iem-timeline').innerHTML=lanes.map(l=>`<div class="iem-time-axis"><span class="iem-time-label text-small">${l.name}</span>${l.phases.map((p,i)=>`<span class="iem-slot ${p}${i===tick?' active':''}" role="img" aria-label="${l.name}, tick ${i+1}, ${p||'idle'}"></span>`).join('')}</div>`).join('');
    const messages=['A enters prefill.','A fills KV pages.','B prefills while A decodes.','Mixed prefill/decode competes for token budget.','C enters prefill while A and B decode.','Decode is efficient as sequences share weight reads.','A emits its final token.','A leaves; B and C continue.','B emits its final token.','B leaves; batch shrinks.','Only C remains.','Scheduler waits for new work.'];
    iemOne('#iem-tick-label').textContent=`Tick ${tick+1}: ${messages[tick]}`;
  }
  iemOne('#iem-step-next').addEventListener('click',()=>{tick=(tick+1)%12;renderTimeline();});
  iemOne('#iem-step-prev').addEventListener('click',()=>{tick=(tick+11)%12;renderTimeline();});
  renderTimeline();

  function updateBig(){
    const p=+iemOne('#iem-big-model').value, prompt=+iemOne('#iem-big-prompt').value, batch=+iemOne('#iem-big-batch').value, bytes=+iemOne('#iem-big-precision').value;
    iemOne('#iem-big-model-out').textContent=`${p}B`; iemOne('#iem-big-prompt-out').textContent=`${prompt} tokens`; iemOne('#iem-big-batch-out').textContent=batch;
    iemOne('#iem-big-weights').textContent=fmtBytes(p*1e9*bytes);
    iemOne('#iem-big-ttft').textContent=fmtOps(2*p*1e9*prompt*batch);
    iemOne('#iem-big-tpot').textContent=fmtOps(2*p*1e9*batch);
  }
  ['iem-big-model','iem-big-prompt','iem-big-batch','iem-big-precision'].forEach(id=>iemOne('#'+id).addEventListener('input',updateBig));

  function showLesson(i) {
    activeLesson = clamp(i, 0, 6);
    iemAll('[data-lesson]').forEach((b, j) => {
      const on = j === activeLesson;
      b.classList.toggle('btn-primary', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    iemAll('[data-lesson-panel]').forEach((p, j) => p.classList.toggle('is-active', j === activeLesson));
    iemOne('#iem-module-step').textContent = `LESSON ${activeLesson + 1} OF 7`;
    iemOne('#m1-prev').disabled = activeLesson === 0;
    iemOne('#m1-next').textContent = activeLesson === 6 ? 'Review lesson 1' : 'Next lesson';
    setProgress(activeLesson + 1, 7, 'Lesson position in Module 1');
    setRoute('module/' + (activeLesson + 1));
    saveProgress();
    if (activeLesson === 5) requestAnimationFrame(drawRoofline);
    iemOne('#iem-progress-label').textContent = `Module 1 · Lesson ${activeLesson + 1} of 7${moduleComplete ? ' · checkpoint passed' : ''}`;
  }
  iemAll('[data-lesson]').forEach(b => b.addEventListener('click', () => showLesson(+b.dataset.lesson)));
  iemOne('#m1-prev').addEventListener('click', () => showLesson(activeLesson - 1));
  iemOne('#m1-next').addEventListener('click', () => showLesson(activeLesson === 6 ? 0 : activeLesson + 1));

  const fmtOps = (v) => v >= 1e12 ? `${fmt(v / 1e12, 2)} TFLOP` : v >= 1e9 ? `${fmt(v / 1e9, 2)} GFLOP` : `${fmt(v / 1e6, 2)} MFLOP`;
  updateBig();
  function updateMatmul() {
    const M = +iemOne('#m1-m').value, K = +iemOne('#m1-k').value, N = +iemOne('#m1-n').value, bytes = +iemOne('#m1-matmul-bytes').value;
    const { flops, traffic: tensorBytes } = matmul(M, K, N, bytes);
    iemOne('#m1-m-out').textContent = M; iemOne('#m1-k-out').textContent = K; iemOne('#m1-n-out').textContent = N;
    iemOne('#m1-a-shape').textContent = `A · ${M}×${K}`; iemOne('#m1-b-shape').textContent = `W · ${K}×${N}`; iemOne('#m1-c-shape').textContent = `C · ${M}×${N}`;
    iemOne('#m1-flops').textContent = fmtOps(flops); iemOne('#m1-matmul-memory').textContent = fmtBytes(tensorBytes); iemOne('#m1-matmul-ai').textContent = `${fmt(flops / tensorBytes, 1)} FLOP/B`;
  }
  ['m1-m','m1-k','m1-n','m1-matmul-bytes'].forEach(id => iemOne('#' + id).addEventListener('input', updateMatmul)); updateMatmul();

  const gpuParts = {
    registers:{title:'Registers',scope:'PER THREAD',speed:'fastest',copy:'Hold live values for each thread. Register pressure can reduce occupancy or spill data into much slower memory.',capacity:'tiny',use:'accumulators, fragments',fail:'spills, low occupancy'},
    shared:{title:'Shared memory / L1',scope:'PER SM',speed:'very fast',copy:'Shared memory is explicitly managed by the kernel; L1 is hardware-managed. They share on-SM resources on many NVIDIA architectures. Tile reuse reduces repeated off-chip traffic.',capacity:'small',use:'GEMM tiles, reductions',fail:'bank conflicts, low residency'},
    l2:{title:'L2 cache',scope:'CHIP-WIDE',speed:'fast',copy:'Shared by SMs and useful for data reused across blocks or repeated kernels. Capacity and access patterns decide the hit rate.',capacity:'medium',use:'weights, activations, KV slices',fail:'low hit rate, contention'},
    hbm:{title:'HBM / VRAM',scope:'DEVICE',speed:'high bandwidth, long latency',copy:'Stores model weights, KV cache, activations, and runtime buffers. Decode often waits on repeated weight reads from HBM.',capacity:'largest on device',use:'weights, KV cache, buffers',fail:'bandwidth saturation, OOM'}
  };
  function showGpuPart(key) {
    const p = gpuParts[key];
    iemAll('[data-gpu-part]').forEach(b => b.classList.toggle('btn-primary', b.dataset.gpuPart === key));
    iemOne('#m1-gpu-title').textContent = p.title; iemOne('#m1-gpu-scope').textContent = p.scope; iemOne('#m1-gpu-speed').textContent = p.speed; iemOne('#m1-gpu-copy').textContent = p.copy; iemOne('#m1-gpu-capacity').textContent = p.capacity; iemOne('#m1-gpu-use').textContent = p.use; iemOne('#m1-gpu-fail').textContent = p.fail;
  }
  iemAll('[data-gpu-part]').forEach(b => b.addEventListener('click', () => showGpuPart(b.dataset.gpuPart)));

  function updateMemoryLesson() {
    const params = +iemOne('#m1-params').value, bytes = +iemOne('#m1-weight-bytes').value, vram = +iemOne('#m1-vram').value, reserve = +iemOne('#m1-reserve').value;
    const m = memoryFit(params, bytes, vram, reserve);
    iemOne('#m1-params-out').textContent = `${params}B`; iemOne('#m1-vram-out').textContent = `${vram} GB`; iemOne('#m1-reserve-out').textContent = `${reserve} GB`;
    iemOne('#m1-weight-memory').textContent = `${fmt(m.weights, 1)} GB`;
    iemOne('#m1-min-gpus').textContent = m.feasible ? m.gpus : 'Not feasible';
    iemOne('#m1-kv-room').textContent = m.feasible ? `${fmt(m.free, 1)} GB / GPU` : 'No space for weights';
    if (!m.feasible) {
      iemOne('#m1-memory-ledger').replaceChildren();
      iemOne('#m1-fit-equation').textContent = `The ${reserve} GB per-GPU reserve consumes or exceeds ${vram} GB VRAM. Reduce reserve or increase GPU memory; adding identical GPUs cannot fix this assumption.`;
      return;
    }
    const rows = [['Weights', m.perGpuWeights, ''], ['Runtime', reserve, 'alt'], ['Workload room', m.free, 'third']];
    iemOne('#m1-memory-ledger').innerHTML = rows.map(([name, value, cls]) => `<div class="iem-memory-row"><span>${name}</span><div class="iem-bar-track"><div class="iem-bar-fill ${cls}" style="width:${value / vram * 100}%"></div></div><span>${fmt(value, 1)} GB</span></div>`).join('');
    iemOne('#m1-fit-equation').textContent = `${fmt(m.perGpuWeights, 1)} GB weights + ${reserve} GB runtime + ${fmt(m.free, 1)} GB workload room = ${vram} GB per GPU (ideal ${m.gpus}-way weight split)`;
  }

  ['m1-params','m1-weight-bytes','m1-vram','m1-reserve'].forEach(id => iemOne('#' + id).addEventListener('input', updateMemoryLesson)); updateMemoryLesson();

  function updateTransfer() {
    const size = +iemOne('#m1-transfer-size').value, bandwidth = +iemOne('#m1-link').value, latencyUs = +iemOne('#m1-latency').value;
    const seconds = size / bandwidth + latencyUs / 1e6;
    const effective = size / seconds;
    iemOne('#m1-transfer-size-out').textContent = `${size} GB`; iemOne('#m1-latency-out').textContent = `${latencyUs} µs`;
    iemOne('#m1-transfer-time').textContent = `${fmt(seconds * 1000, 2)} ms`; iemOne('#m1-effective-bandwidth').textContent = `${fmt(effective, 1)} GB/s`; iemOne('#m1-layer-transfer').textContent = `${fmt(seconds * 4000, 1)} ms`;
    iemOne('#m1-transfer-observation').textContent = latencyUs / 1e6 >= size / bandwidth ? 'For small messages, fixed latency and synchronization become visible. Many tiny collectives can underperform one larger transfer.' : bandwidth < 20 ? 'This path is slow enough that crossing it repeatedly can erase multi-GPU compute savings. Placement and parallelism strategy matter.' : 'Large transfers approach the bandwidth term. Reduce bytes or increase reuse before assuming more compute will help.';
  }
  ['m1-transfer-size','m1-link','m1-latency'].forEach(id => iemOne('#' + id).addEventListener('input', updateTransfer)); updateTransfer();

  let roofState = roofline(120, .5, 300, 3);
  function drawRoofline() {
    const svg = iemOne('#m1-roof-chart'), width = svg.parentElement.clientWidth;
    if (width < 100 || !svg.getClientRects().length) return;
    const height = 290, left = 64, right = width - 18, top = 24, bottom = height - 58;
    const { intensity, ridge, attainable } = roofState;
    const peak = +iemOne('#m1-peak').value, bandwidth = +iemOne('#m1-bandwidth').value;
    const xMin = 10 ** Math.floor(Math.log10(Math.min(intensity, ridge) / 4));
    const xMax = 10 ** Math.ceil(Math.log10(Math.max(intensity, ridge) * 4));
    const yMin = 10 ** Math.floor(Math.log10(Math.min(peak, xMin * bandwidth) / 2));
    const yMax = 10 ** Math.ceil(Math.log10(peak * 1.5));
    const x = v => left + (Math.log10(v) - Math.log10(xMin)) / Math.log10(xMax / xMin) * (right - left);
    const y = v => bottom - (Math.log10(v) - Math.log10(yMin)) / Math.log10(yMax / yMin) * (bottom - top);
    const ticks = (min, max, count) => {
      const lo = Math.log10(min), hi = Math.log10(max), step = Math.max(1, Math.ceil((hi-lo) / (count-1)));
      return Array.from({length:Math.floor((hi-lo)/step)+1}, (_,i) => 10 ** (lo+i*step));
    };
    const label = v => v >= 10000 ? v.toExponential(0).replace('+','') : fmt(v, 4);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `<title id="roof-title">Roofline performance ceiling</title><desc id="roof-desc">Logarithmic axes. Workload intensity ${fmt(intensity,2)} FLOP per byte; ridge ${fmt(ridge,2)}; ceiling ${fmt(attainable,2)} TFLOP per second. The workload marker lies on the modeled roofline.</desc>
      <defs><clipPath id="roof-clip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs>
      <rect data-chart-frame x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="none" stroke="var(--border)"/>
      ${ticks(xMin,xMax,width < 500 ? 4 : 6).map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${bottom}" stroke="var(--border)" opacity=".5"/><text x="${x(v)}" y="${bottom+22}" text-anchor="${v===xMin?'start':v===xMax?'end':'middle'}">${label(v)}</text>`).join('')}
      ${ticks(yMin,yMax,5).map(v=>`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" opacity=".5"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${label(v)}</text>`).join('')}
      <g clip-path="url(#roof-clip)">
        <path id="roof-path" d="M ${x(xMin)} ${y(xMin*bandwidth)} L ${x(ridge)} ${y(peak)} L ${x(xMax)} ${y(peak)}" fill="none" stroke="var(--iem-s1)" stroke-width="3"/>
        <line x1="${x(ridge)}" x2="${x(ridge)}" y1="${y(peak)}" y2="${bottom}" stroke="var(--muted-foreground)" stroke-dasharray="4 4"/>
        <circle id="roof-ridge" cx="${x(ridge)}" cy="${y(peak)}" r="4" fill="var(--background)" stroke="var(--iem-s1)" stroke-width="2"/>
        <circle id="m1-roof-dot" cx="${x(intensity)}" cy="${y(attainable)}" r="6" fill="var(--iem-s3)" stroke="var(--background)" stroke-width="2"/>
      </g>
      <text class="axis-title" data-axis="x" x="${(left+right)/2}" y="${height-12}" text-anchor="middle">Arithmetic intensity (FLOP/B)</text>
      <text class="axis-title" data-axis="y" transform="translate(14 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle">Ceiling (TFLOP/s)</text>`;
  }
  new ResizeObserver(drawRoofline).observe(iemOne('.iem-roofline'));
  function updateRoofline(markCustom = true) {
    const ops = +iemOne('#m1-ops').value, moved = +iemOne('#m1-bytes-moved').value, peak = +iemOne('#m1-peak').value, bandwidth = +iemOne('#m1-bandwidth').value;
    roofState = roofline(ops, moved, peak, bandwidth);
    const { intensity, ridge, attainable, seconds, bound } = roofState;
    iemOne('#m1-ops-out').textContent = `${ops} TFLOP`; iemOne('#m1-bytes-moved-out').textContent = `${moved} TB`; iemOne('#m1-peak-out').textContent = `${peak} TFLOP/s`; iemOne('#m1-bandwidth-out').textContent = `${bandwidth} TB/s`;
    iemOne('#m1-ai').textContent = `${fmt(intensity, 1)} FLOP/B`; iemOne('#m1-ridge').textContent = `${fmt(ridge, 1)} FLOP/B`; iemOne('#m1-roof-time').textContent = `${fmt(seconds * 1000, 1)} ms`; iemOne('#m1-bound').textContent = bound;
    iemOne('#m1-roof-summary').textContent = `Filled marker: workload ceiling ${fmt(attainable,2)} TFLOP/s at ${fmt(intensity,2)} FLOP/B. Hollow marker and dashed line: ridge at ${fmt(ridge,2)} FLOP/B. Axes rescale to keep both visible.`;
    drawRoofline();
    if (markCustom) iemAll('[data-roof-preset]').forEach(b => { const on = b.dataset.roofPreset === 'custom'; b.classList.toggle('btn-primary', on); b.setAttribute('aria-pressed', on); });
  }

  const roofPresets = {prefill:[120,.5,300,3], decode:[14,2.8,300,3]};
  iemAll('[data-roof-preset]').forEach(b => b.addEventListener('click', () => {
    iemAll('[data-roof-preset]').forEach(x => x.classList.toggle('btn-primary', x === b));
    const values = roofPresets[b.dataset.roofPreset];
    if (values) ['m1-ops','m1-bytes-moved','m1-peak','m1-bandwidth'].forEach((id, i) => { iemOne('#' + id).value = values[i]; });
    updateRoofline(false);
  }));
  ['m1-ops','m1-bytes-moved','m1-peak','m1-bandwidth'].forEach(id => iemOne('#' + id).addEventListener('input', () => updateRoofline(true))); updateRoofline(false);

  const moduleQuiz = [
    {q:'A 7B-parameter model stores BF16 weights. What is the approximate weight memory before runtime overhead?', options:['7 GB','14 GB','28 GB'], correct:1, why:'BF16 uses 2 bytes per parameter: 7 billion × 2 bytes ≈ 14 GB.'},
    {q:'Why can decode become memory-bandwidth bound even when the GPU has enormous compute throughput?', options:['It repeatedly reads model weights for little token work','Softmax always runs on the CPU','Network latency is included in every multiply'], correct:0, why:'A small decode batch performs little arithmetic per byte of weights read, so compute units wait for HBM.'},
    {q:'M=32, K=4096, N=4096. Which change most directly increases weight reuse in the matrix multiply?', options:['Reduce M to 1','Increase M by batching more tokens','Move weights through PCIe each step'], correct:1, why:'A larger M applies the same weight matrix to more rows, increasing arithmetic intensity.'},
    {q:'A model fits by weight size but still OOMs under traffic. What ledger entry is most likely missing?', options:['KV cache and temporary runtime buffers','The model license text','Client-side CSS'], correct:0, why:'Fit must include KV cache, activations, communication buffers, graphs, fragmentation, and runtime reservations.'},
    {q:'Adding GPUs makes latency worse and collective time rises sharply. What should you inspect first?', options:['Tokenizer vocabulary size','GPU/network topology and per-rank collective traces','Sampling temperature'], correct:1, why:'The added ranks may cross a slow link or synchronize on a straggler, erasing saved compute.'}
  ];
  let quizIndex = 0;
  const quizSolved = new Set((Array.isArray(saved.solved) ? saved.solved : []).filter(i => Number.isInteger(i) && i >= 0 && i < moduleQuiz.length));
  moduleComplete = saved.complete === true && quizSolved.size >= 4;
  if (moduleComplete) iemOne('#m1-complete-status').textContent = 'Module 1 checkpoint complete. Results restored from this browser.';
  function renderModuleQuiz() {
    const q = moduleQuiz[quizIndex];
    iemOne('#m1-quiz-count').textContent = `QUESTION ${quizIndex + 1} OF ${moduleQuiz.length}`;
    iemOne('#m1-quiz-question').textContent = q.q;
    iemOne('#m1-quiz-options').innerHTML = q.options.map((option, i) => `<label><input class="form-check-input" type="radio" name="m1-quiz-choice" value="${i}"><span>${option}</span></label>`).join('');
    iemOne('#m1-quiz-feedback').textContent = quizSolved.has(quizIndex) ? `Correct. ${q.why}` : 'Choose the answer you can justify from the resource model.';
    iemOne('#m1-quiz-score').textContent = `Score ${quizSolved.size} / ${moduleQuiz.length}`;
  }
  iemOne('#m1-quiz-check').addEventListener('click', () => {
    const selected = iemOne('input[name="m1-quiz-choice"]:checked');
    if (!selected) { iemOne('#m1-quiz-feedback').textContent = 'Choose an answer first.'; return; }
    const q = moduleQuiz[quizIndex];
    if (+selected.value === q.correct) { quizSolved.add(quizIndex); iemOne('#m1-quiz-feedback').textContent = `Correct. ${q.why}`; }
    else iemOne('#m1-quiz-feedback').textContent = `Not yet. Recheck which resource moves or performs work. ${q.why}`;
    iemOne('#m1-quiz-score').textContent = `Score ${quizSolved.size} / ${moduleQuiz.length}`;
    saveProgress();
  });
  iemOne('#m1-quiz-next').addEventListener('click', () => { quizIndex = (quizIndex + 1) % moduleQuiz.length; renderModuleQuiz(); });
  iemOne('#m1-complete').addEventListener('click', () => {
    if (quizSolved.size < 4) { iemOne('#m1-complete-status').textContent = `Current score: ${quizSolved.size}/5. Reach 4/5 to complete the checkpoint.`; return; }
    moduleComplete = true;
    iemOne('#m1-complete-status').textContent = 'Module 1 complete. Continue with the simulators, metrics, and debug lab.';
    showLesson(6);
  });
  renderModuleQuiz();

  iemAll('[data-sim]').forEach(b=>b.addEventListener('click',()=>{
    iemAll('[data-sim]').forEach(x=>x.classList.toggle('btn-primary',x===b));
    iemAll('[data-sim-panel]').forEach(p=>p.classList.toggle('iem-hidden',p.dataset.simPanel!==b.dataset.sim));
    setRoute('sim/' + b.dataset.sim);
  }));
  function updateKV(){
    const L=+iemOne('#kv-layers').value,H=+iemOne('#kv-heads').value,D=+iemOne('#kv-dim').value,S=+iemOne('#kv-seq').value,B=+iemOne('#kv-batch').value,Y=+iemOne('#kv-bytes').value;
    iemOne('#kv-layers-out').textContent=L;iemOne('#kv-heads-out').textContent=H;iemOne('#kv-dim-out').textContent=D;iemOne('#kv-seq-out').textContent=`${S} tokens`;iemOne('#kv-batch-out').textContent=B;
    const {perToken, allocated, logical, pages}=kvCache(L,H,D,S,B,Y);
    iemOne('#kv-total').textContent=fmtBytes(allocated);iemOne('#kv-per-token').textContent=fmtBytes(perToken);iemOne('#kv-pages').textContent=fmt(pages,0);
    const vram=80e9, weights=14e9, runtime=4e9, budget=vram-weights-runtime, free=Math.max(0,budget-allocated);
    const segs=[['Weights',weights],['KV pages',allocated],['Runtime',runtime],['Free',free]], scale=Math.max(vram,allocated);
    iemOne('#kv-stack').innerHTML=segs.map(([n,v])=>`<div><div class="iem-bar-label"><span>${n}</span><span>${fmtBytes(v)}</span></div><div class="iem-bar-track"><div class="iem-bar-fill" style="width:${v/scale*100}%"></div></div></div>`).join('');
    iemOne('#kv-observation').textContent=`Live tensors: ${fmtBytes(logical)}. Page padding: ${fmtBytes(allocated-logical)}. `+(allocated>budget?`Exceeds the 62 GB KV budget by ${fmtBytes(allocated-budget)}. Reduce admitted tokens or revise the memory plan.`:`Each extra cached token adds ${fmtBytes(perToken*B)} of logical KV across the batch; allocation grows in pages.`);
  }

  ['kv-layers','kv-heads','kv-dim','kv-seq','kv-batch','kv-bytes'].forEach(id=>iemOne('#'+id).addEventListener('input',updateKV)); updateKV();

  function updatePD(){
    const P=+iemOne('#pd-prompt').value,O=+iemOne('#pd-output').value,B=+iemOne('#pd-batch').value,M=+iemOne('#pd-model').value;
    iemOne('#pd-prompt-out').textContent=P;iemOne('#pd-output-out').textContent=O;iemOne('#pd-batch-out').textContent=B;iemOne('#pd-model-out').textContent=`${M}B`;
    const { prefill, decode, decodeSteps }=denseWork(M,P,O,B);
    iemOne('#pd-prefill-work').textContent=fmtOps(prefill);iemOne('#pd-decode-steps').textContent=fmt(decodeSteps,0);
    iemOne('#pd-bound').textContent='Not determined';
    const max=Math.max(prefill,decode);iemOne('#pd-prefill-bar').style.width=`${prefill/max*100}%`;iemOne('#pd-decode-bar').style.width=`${decode/max*100}%`;
    iemOne('#pd-prefill-label').textContent=fmtOps(prefill);iemOne('#pd-decode-label').textContent=fmtOps(decode)+' total';
    iemOne('#pd-observation').textContent=`Prefill processes ${fmt(P*B,0)} prompt tokens and supplies the first output token per sequence. Producing ${O} output tokens takes ${decodeSteps} subsequent decode steps. Batching ${B} sequences amortizes weight reads, while KV reads grow with context.`;
  }

  ['pd-prompt','pd-output','pd-batch','pd-model'].forEach(id=>iemOne('#'+id).addEventListener('input',updatePD)); updatePD();

  function updateQ(){
    const M=+iemOne('#q-model').value,V=+iemOne('#q-vram').value;iemOne('#q-model-out').textContent=`${M}B`;iemOne('#q-vram-out').textContent=`${V} GB`;
    const formats=[['FP32',4,'higher storage; model-dependent reference'],['BF16',2,'common baseline'],['FP8 / INT8',1,'kernel + calibration dependent'],['INT4',.5,'evaluate quality and kernel support']];
    iemOne('#q-bars').innerHTML=formats.map(([n,b,note])=>{const gb=M*b,pct=clamp(gb/(M*4)*100,2,100),fit=Math.ceil(gb/V);return `<div><div class="iem-bar-label"><span>${n} · ${fmt(gb,1)} GB</span><span>${fit} × ${V} GB GPU${fit>1?'s':''} · weights only</span></div><div class="iem-bar-track"><div class="iem-bar-fill${b===2?' alt':b===1?' third':''}" style="width:${pct}%"></div></div><div class="text-muted text-small">${note}</div></div>`}).join('');
  }
  ['q-model','q-vram'].forEach(id=>iemOne('#'+id).addEventListener('input',updateQ));updateQ();

  function updateTP(){
    const M=+iemOne('#tp-model').value,N=+iemOne('#tp-degree').value,L=+iemOne('#tp-link').value;
    const baseline=+iemOne('#tp-baseline').value,payload=+iemOne('#tp-message').value,count=+iemOne('#tp-count').value,latency=+iemOne('#tp-latency').value;
    iemOne('#tp-model-out').textContent=`${M}B`;iemOne('#tp-degree-out').textContent=N;iemOne('#tp-link-out').textContent=`${L} GB/s`;
    for (const [id,v,unit] of [['baseline',baseline,'ms'],['message',payload,'MB'],['count',count,''],['latency',latency,'µs']]) iemOne('#tp-'+id+'-out').textContent=`${v} ${unit}`.trim();
    const mem=M*2/N, result=parallelModel(N,baseline,payload,count,L,latency);
    iemOne('#tp-memory').textContent=`${fmt(mem,1)} GB`;iemOne('#tp-ideal').textContent=`${N}×`;iemOne('#tp-eff').textContent=`${fmt(result.stepMs,2)} ms`;
    iemOne('#tp-gpus').innerHTML=Array.from({length:N},(_,i)=>`<div class="iem-gpu"><strong>GPU ${i+1}</strong><span>1/${N} weights</span><span class="text-muted">${fmt(mem,1)} GB</span></div>`).join('');
    iemOne('.iem-comm-line').hidden=N===1;
    iemOne('#tp-observation').textContent=`${fmt(baseline/N,2)} ms ideal compute + ${fmt(result.communicationMs,2)} ms communication = ${fmt(result.stepMs,2)} ms. Modeled speedup: ${fmt(result.speedup,2)}×. `+(N===1?'One GPU has zero TP communication.':'Communication can exceed the compute saved by adding ranks.');
  }
  ['tp-model','tp-degree','tp-link','tp-baseline','tp-message','tp-count','tp-latency'].forEach(id=>iemOne('#'+id).addEventListener('input',updateTP));updateTP();

  function updateSC(){
    const A=+iemOne('#sc-arrival').value,O=+iemOne('#sc-output').value,throughput=+iemOne('#sc-throughput').value;
    iemOne('#sc-arrival-out').textContent=`${A} req/s`;iemOne('#sc-output-out').textContent=`${O} tokens`;iemOne('#sc-throughput-out').textContent=`${throughput} tokens/s`;
    const {capacity,offeredLoad,backlog,regime}=queueModel(A,O,throughput);
    iemOne('#sc-util').textContent=`${fmt(offeredLoad*100,1)}%`;iemOne('#sc-queue').textContent=`${fmt(backlog,1)} req`;iemOne('#sc-p99').textContent=regime;
    const max=Math.max(A,capacity);iemOne('#sc-demand-bar').style.width=`${A/max*100}%`;iemOne('#sc-capacity-bar').style.width=`${capacity/max*100}%`;iemOne('#sc-demand-label').textContent=`${A} req/s`;iemOne('#sc-capacity-label').textContent=`${fmt(capacity,1)} req/s`;
    iemOne('#sc-observation').textContent=offeredLoad>1?'Offered work exceeds assumed sustained capacity. With no rejection, backlog grows; bound admission or change the capacity/workload.':offeredLoad===1?'No headroom remains. Bursts or service-time variation can create queues even though the fluid backlog is zero.':'Average offered work is below assumed capacity. Zero excess arrivals in this model does not mean zero wait or a guaranteed latency SLO.';
  }
  ['sc-arrival','sc-output','sc-throughput'].forEach(id=>iemOne('#'+id).addEventListener('input',updateSC));updateSC();

  const metrics=[
    ['TTFT','Request sent/received → first output token','Choose client or server timing explicitly','Includes waiting + prefill + first-token selection; no extra decode pass is required for that token'],
    ['TPOT','(E2E − TTFT) / (output tokens − 1)','Per-request mean after the first token','Undefined for ≤1 output token; exclude or state tool convention. Averages hide stalls'],
    ['ITL','Gap between successive output events','Streaming cadence at a defined boundary','A stream event may contain several tokens. Do not equate chunk intervals with per-token latency'],
    ['E2E','Request sent/received → final output','Total user wait at the chosen boundary','State whether final token or response completion ends the clock; output length matters'],
    ['Output tok/s','Output tokens counted / measurement seconds','Aggregate serving throughput','Specify window, warmup/drain, failures, input/output mix and latency; not per-user token speed'],
    ['Requests/s','Completed requests ÷ wall time','Business transaction capacity','Short requests dominate the number'],
    ['Queue time','First scheduled execution − server arrival','Demand/capacity mismatch','Low average can hide aged requests'],
    ['GPU utilization','Time GPU reports active','Whether device is busy','Busy can be inefficient or stalled'],
    ['SM activity','SM active cycles / elapsed cycles','Execution activity (counter-dependent)','Not occupancy: occupancy measures resident active warps relative to the hardware maximum'],
    ['Bandwidth utilization','Measured bytes/s ÷ peak','Memory pressure','Peak spec may not be attainable'],
    ['MFU','Estimated model FLOPs/s / matching peak FLOP/s','Model compute rate relative to hardware','Use all devices, the actual precision, dense/sparse convention, and explicit FLOP counting'],
    ['p99','99th percentile of a stated metric','Tail latency for a defined request population','Report samples, window, failures/timeouts and load. Averages of replica percentiles are not fleet p99']
  ];
  iemOne('#iem-metric-grid').innerHTML=metrics.map(m=>`<div class="iem-metric"><strong>${m[0]}</strong><span>${m[1]}</span><div class="text-muted text-small">Why: ${m[2]} · Trap: ${m[3]}</div></div>`).join('');

  const scenarios=[
    {code:'A',title:'VRAM full, GPU utilization 40%',arch:'1 GPU · paged KV · mixed traffic',signals:[['Memory','78 / 80 GB','Capacity or leak?'],['SM active','40%','Why idle cycles?'],['Queue','low','Is demand sufficient?']],options:['Profile request arrival and batch occupancy','Enable more KV cache immediately','Add tensor parallelism immediately'],correct:0,cause:'The server may be memory-capacity bound but demand/batch occupancy bound for compute. Full VRAM often means reserved weights + KV pool, not active work.',confirm:'Active sequences, batch tokens, scheduler trace, SM and memory-bandwidth timelines.',fix:'Increase safe concurrency or improve batching; resize reservation only after proving it blocks admission.'},
    {code:'B',title:'Excellent TTFT, terrible TPOT',arch:'8B · low prompt load · streaming',signals:[['TTFT','110 ms','Prefill healthy'],['TPOT','95 ms','Decode slow'],['HBM BW','88%','Likely bound?']],options:['Inspect decode bandwidth and batch occupancy','Optimize tokenizer first','Increase prompt chunk size'],correct:0,cause:'High HBM traffic suggests a bandwidth limit. Weight reads at small batches or KV reads at long contexts are candidates; utilization alone does not identify which.',confirm:'Decode kernel timeline, achieved HBM bandwidth, active sequences per step.',fix:'Test batching for throughput and lower-bit supported kernels for traffic. More concurrency can worsen per-request TPOT; verify the latency SLO and quality.'},
    {code:'C',title:'Adding GPUs makes inference slower',arch:'TP 8 across two nodes',signals:[['Compute/GPU','down 48%','Expected'],['Collective time','up 4.2×','Topology'],['Link','100 GbE','Mismatch']],options:['Measure collective latency by topology','Raise max sequence length','Disable streaming'],correct:0,cause:'Tensor parallel collectives cross a slow node boundary; communication and synchronization exceed saved compute.',confirm:'NCCL trace, all-reduce duration, topology map, per-rank skew.',fix:'Keep TP within fast domains, use pipeline/data replicas across nodes, or improve interconnect and message overlap.'},
    {code:'D',title:'Batching lifts throughput, destroys latency',arch:'Static batcher · 50 ms window',signals:[['Throughput','+71%','Amortization works'],['Queue wait','+44 ms','Batch formation'],['p99 E2E','+190%','Tail penalty']],options:['Split queue time from execution time','Quantize KV cache','Increase batching window'],correct:0,cause:'The batcher waits to fill and long sequences hold the whole static batch; throughput gain is paid in queue and head-of-line latency.',confirm:'Request trace decomposed into queue, prefill, decode, streaming.',fix:'Continuous/token-level batching, shorter wait windows, length-aware scheduling, SLO-based admission.'},
    {code:'E',title:'Model fits on 8 GPUs, not 4',arch:'70B BF16 · 80 GB GPUs',signals:[['Weights','140 GB','Before overhead'],['KV budget','180 GB total','Traffic target'],['Runtime','~20 GB total','Graphs + buffers']],options:['Build a per-rank memory ledger','Raise GPU utilization target blindly','Disable metrics'],correct:0,cause:'140 GB weights + 180 GB KV + about 20 GB runtime = 340 GB total, exceeding four 80 GB GPUs (320 GB). Eight offer 640 GB, but per-rank placement and peak buffers still decide actual fit.',confirm:'Peak and reserved memory by category and rank, including worst prompt/concurrency mix.',fix:'Quantize, shard differently, reduce cache/concurrency/context, or add memory-capable ranks.'},
    {code:'F',title:'Eight replicas underperform four',arch:'8 replicas · shared host + NIC',signals:[['GPU active','55% each','Starved?'],['CPU','96%','Shared choke point'],['NIC','92%','Contention']],options:['Profile shared CPU, PCIe, storage, and NIC','Double replica count','Increase tensor parallel degree'],correct:0,cause:'A shared tokenizer, CPU, PCIe root, storage path, or NIC saturates; more replicas divide the bottleneck and add contention.',confirm:'Host flame graph, per-core saturation, PCIe/NIC counters, request routing skew.',fix:'Shard frontends, pin CPU/NUMA resources, balance routes, separate NIC paths, or stop at the measured saturation point.'}
  ];
  const scenarioList=iemOne('#iem-scenario-list');
  scenarios.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className=`btn${i===0?' btn-primary':''}`;b.dataset.scenario=i;b.textContent=`${s.code} · ${s.title}`;scenarioList.appendChild(b);});
  let activeScenario=0;
  function showScenario(i){activeScenario=i;const s=scenarios[i];iemAll('[data-scenario]').forEach((b,j)=>b.classList.toggle('btn-primary',j===i));iemOne('#lab-code').textContent=`SCENARIO ${s.code}`;iemOne('#lab-title').textContent=s.title;iemOne('#lab-architecture').textContent=s.arch;iemOne('#lab-signals').innerHTML=s.signals.map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td><td class="text-muted">${x[2]}</td></tr>`).join('');iemOne('#lab-options').innerHTML=s.options.map((x,j)=>`<label><input class="form-check-input" type="radio" name="lab-choice" value="${j}"><span>${x}</span></label>`).join('');iemOne('#lab-feedback').textContent='';iemOne('#lab-answer').classList.remove('is-visible');iemOne('#lab-cause').textContent=s.cause;iemOne('#lab-confirm').textContent=s.confirm;iemOne('#lab-fix').textContent=s.fix;}
  scenarioList.addEventListener('click',e=>{const b=e.target.closest('[data-scenario]');if(b)showScenario(+b.dataset.scenario);});
  iemOne('#lab-check').addEventListener('click',()=>{const c=iemOne('input[name="lab-choice"]:checked');if(!c){iemOne('#lab-feedback').textContent='Choose a first test.';return;}const s=scenarios[activeScenario];iemOne('#lab-feedback').textContent=+c.value===s.correct?'Strong first move: measure the suspected boundary.':'That may matter later, but it skips the fastest discriminating measurement.';iemOne('#lab-answer').classList.add('is-visible');});showScenario(0);

  const projects=[
    ['1','Run a small Transformer','Trace tokens → logits → sampled token.'],['2','Build an inference API','Separate request handling from model execution.'],['3','Implement batching','Measure throughput/latency trade-offs.'],['4','Stream generation','Handle cancellation and backpressure.'],['5','Add KV-aware admission','Budget memory per active sequence.'],['6','Benchmark batch sizes','Find saturation and plot latency distributions.'],['7','Quantize a model','Compare memory, kernels, quality, and speed.'],['8','Deploy with vLLM','Map engine controls to serving principles.'],['9','Optimize vLLM','Profile, hypothesize, tune, and verify.'],['10','Serve multiple GPUs','Choose TP/PP/replicas from topology.'],['11','Build an inference gateway','Route, rate-limit, shed, and observe load.'],['12','Design the platform','Rollouts, autoscaling, SLOs, and failures.']
  ];
  iemOne('#iem-project-grid').innerHTML=projects.map((p,i)=>`<div class="iem-project"><div class="iem-project-head"><strong>Project ${p[0]} · ${p[1]}</strong><span class="iem-stage-dot ${i===0?'current':'future'}" role="img" aria-label="${i===0?'current':'future'}"></span></div><span class="text-muted">${p[2]}</span></div>`).join('');
  iemOne('#iem-capstone').addEventListener('click',()=>{
    const open = iemOne('#iem-capstone-brief').classList.toggle('is-visible');
    iemOne('#iem-capstone').setAttribute('aria-expanded', open);
  });

  // Keep button-group state available to keyboard and screen-reader users.
  function syncPressed() {
    iemAll('[data-sim], [data-gpu-part], [data-roof-preset], [data-scenario]').forEach(b => b.setAttribute('aria-pressed', b.classList.contains('btn-primary')));
  }
  root.addEventListener('click', () => queueMicrotask(syncPressed));
  root.addEventListener('input', () => queueMicrotask(syncPressed));
  iemAll('.iem-stats, #lab-feedback, #m1-quiz-feedback, #m1-complete-status, #iem-tick-label').forEach(el => el.setAttribute('aria-live', 'polite'));
  iemAll('[data-lesson-panel]').forEach(el => el.setAttribute('aria-label', 'Module 1 lesson ' + (+el.dataset.lessonPanel + 1)));

  function applyRoute() {
    const parts = location.hash.slice(1).split('/');
    if (parts[0] === 'main') return;
    applyingRoute = true;
    if (parts[0] === 'module') {
      const lesson = Number(parts[1]);
      if (Number.isInteger(lesson) && lesson >= 1 && lesson <= 7) activeLesson = lesson-1;
    }
    switchView(parts[0] || 'map');
    if (activeView === 'map') {
      const layer = Number(parts[1]);
      showLayer(Number.isInteger(layer) && layer >= 1 && layer <= 13 ? layer-1 : 0);
    }
    if (activeView === 'sim' && ['kv','prefill','quant','tp','scheduler'].includes(parts[1])) iemOne('[data-sim="'+parts[1]+'"]').click();
    syncPressed();
    applyingRoute = false;
  }
  window.addEventListener('hashchange', applyRoute);
  applyingRoute = true;
  showLayer(0);
  applyingRoute = false;
  applyRoute();

})();
