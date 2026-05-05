/* ============================================================================
 * 10-geometry — Graham's scan convex hull.
 *
 * Click on the canvas to drop points; press Run; watch the algorithm:
 *
 *   1. find the pivot   — point with greatest screen-y (lowest visually);
 *                         ties broken by smallest x.
 *   2. polar sort       — order all other points by polar angle CCW around
 *                         the pivot.  Sort uses the cross-product test
 *                         (no atan2, no floating-point drift).
 *   3. scan             — push points onto a stack one by one.  Before
 *                         each push, while the top two stack points plus
 *                         the candidate make a non-CCW turn (right turn
 *                         or collinear), pop.
 *
 * The cross-product test crossScreen(O, A, B) is the workhorse:
 *
 *   = (Ax - Ox)(By - Oy) - (Ay - Oy)(Bx - Ox)
 *
 * In screen coordinates (y increases downward):
 *   < 0  : O→A→B is a LEFT turn visually   (counter-clockwise)
 *   > 0  : O→A→B is a RIGHT turn visually  (clockwise)
 *   = 0  : collinear
 *
 * Graham's scan keeps the LEFT turns and pops the RIGHT turns.
 * ========================================================================== */

(function () {
  "use strict";

  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_BG       = css("--bg-soft", "#F7F7F5");
  const C_TEXT     = css("--text",    "#333333");
  const C_TITLE    = css("--title",   "#3B6EA8");
  const C_ACCENT   = css("--accent",  "#C04040");
  const C_MUTED    = css("--muted",   "#7A7A7A");
  const C_LIGHT    = css("--light",   "#CCCCCC");
  const C_HULL     = "#3B6EA8";
  const C_HULL_FILL= "rgba(59, 110, 168, 0.10)";
  const C_PIVOT    = "#1F4A7F";
  const C_CANDIDATE= "#C04040";
  const C_TEST_POS = "#C04040";
  const C_TEST_NEG = "#3B6EA8";
  const C_SORT_RAY = "#D5D5D5";
  const C_GRID     = "#EFEFEF";

  /* ============================================================ algorithm */

  function crossScreen(O, A, B) {
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  }
  function distSq(O, A) {
    const dx = A.x - O.x, dy = A.y - O.y;
    return dx * dx + dy * dy;
  }

  function* grahamScan(points) {
    const n = points.length;
    if (n < 3) {
      yield { type: 'done', hull: points.map((_, i) => i), trivial: true };
      return;
    }

    // ---- Phase 1: find pivot ----
    yield { type: 'phase', phase: 'pivot' };
    let pivotIdx = 0;
    yield { type: 'pivot-consider', i: 0, currentBest: 0 };
    for (let i = 1; i < n; i++) {
      yield { type: 'pivot-consider', i, currentBest: pivotIdx };
      if (points[i].y > points[pivotIdx].y ||
          (points[i].y === points[pivotIdx].y && points[i].x < points[pivotIdx].x)) {
        pivotIdx = i;
        yield { type: 'pivot-update', pivotIdx };
      }
    }
    yield { type: 'pivot-found', pivotIdx };

    const pivot = points[pivotIdx];

    // ---- Phase 2: polar sort ----
    yield { type: 'phase', phase: 'sort', pivotIdx };
    const order = [];
    for (let i = 0; i < n; i++) if (i !== pivotIdx) order.push(i);
    yield { type: 'sort-start', order: order.slice(), pivotIdx };

    // Insertion sort, visualising every comparison
    for (let i = 1; i < order.length; i++) {
      let j = i;
      while (j > 0) {
        const aIdx = order[j-1], bIdx = order[j];
        const a = points[aIdx], b = points[bIdx];
        const cross = crossScreen(pivot, a, b);
        yield { type: 'sort-compare', aIdx, bIdx, cross, pivotIdx, order: order.slice() };
        let swap = false;
        if (cross < 0) {
          // a has smaller polar angle; already in order
          break;
        } else if (cross > 0) {
          swap = true;
        } else {
          // collinear: nearer to pivot first
          if (distSq(pivot, a) > distSq(pivot, b)) swap = true;
          else break;
        }
        if (swap) {
          [order[j-1], order[j]] = [order[j], order[j-1]];
          yield { type: 'sort-swap', aIdx: order[j-1], bIdx: order[j], pivotIdx, order: order.slice() };
          j--;
        }
      }
    }
    yield { type: 'sort-done', order: order.slice(), pivotIdx };

    // ---- Phase 3: scan ----
    yield { type: 'phase', phase: 'scan', pivotIdx };
    const stack = [pivotIdx, order[0]];
    yield { type: 'scan-init', stack: stack.slice(), order: order.slice(), pivotIdx };

    for (let i = 1; i < order.length; i++) {
      const candidate = order[i];
      yield { type: 'scan-consider', candidate, stack: stack.slice(), order: order.slice(), pivotIdx };

      while (stack.length >= 2) {
        const top = stack[stack.length - 1];
        const second = stack[stack.length - 2];
        const O = points[second], A = points[top], B = points[candidate];
        const cross = crossScreen(O, A, B);
        yield { type: 'scan-test', second, top, candidate, cross, stack: stack.slice(), order: order.slice(), pivotIdx };
        if (cross >= 0) {
          stack.pop();
          yield { type: 'scan-pop', popped: top, candidate, stack: stack.slice(), order: order.slice(), pivotIdx };
        } else {
          break;
        }
      }

      stack.push(candidate);
      yield { type: 'scan-push', point: candidate, stack: stack.slice(), order: order.slice(), pivotIdx };
    }

    yield { type: 'phase', phase: 'done', pivotIdx };
    yield { type: 'done', hull: stack.slice(), pivotIdx };
  }

  /* ============================================================ DOM */

  const board = document.getElementById('geo-board');
  const panel = document.createElement('div');
  panel.className = 'geo-panel';
  panel.innerHTML =
    '<div class="head">' +
      '<span class="name">Graham scan · convex hull</span>' +
      '<span class="complexity">O(n log n) — dominated by polar sort</span>' +
    '</div>' +
    '<div class="stats">' +
      '<span><span class="label">phase</span><span class="phase">idle</span></span>' +
      '<span><span class="label">points</span><span class="pts">0</span></span>' +
      '<span><span class="label">comparisons</span><span class="cmp">0</span></span>' +
      '<span><span class="label">pops</span><span class="pops">0</span></span>' +
      '<span><span class="label">hull size</span><span class="hsize">0</span></span>' +
      '<span class="cross-disp"></span>' +
    '</div>' +
    '<canvas></canvas>' +
    '<div class="geo-instructions">click anywhere on the canvas to drop points · 3 minimum to compute a hull</div>';
  board.appendChild(panel);

  const canvas   = panel.querySelector('canvas');
  const phaseEl  = panel.querySelector('.phase');
  const ptsEl    = panel.querySelector('.pts');
  const cmpEl    = panel.querySelector('.cmp');
  const popsEl   = panel.querySelector('.pops');
  const hsizeEl  = panel.querySelector('.hsize');
  const crossEl  = panel.querySelector('.cross-disp');

  /* ============================================================ state */

  let points     = [];        // [{x, y}, ...] — user-placed
  let running    = false;
  let paused     = false;
  let gen        = null;      // active generator
  let lastState  = null;      // most recent yielded state
  let hullFinal  = null;      // final hull idx[] (after 'done')
  let stats      = { cmp: 0, pops: 0 };
  let speed      = 8;

  /* ============================================================ canvas */

  let dpr = window.devicePixelRatio || 1;
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function drawPoint(ctx, x, y, color, size, label) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.fillStyle = C_TEXT;
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + size + 4, y - 1);
    }
  }

  function drawGrid(ctx, w, h) {
    ctx.strokeStyle = C_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  function render() {
    const { ctx, w, h } = fitCanvas();
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h);

    const state = lastState;

    // ---- background lines (sort phase only) ----
    if (state && state.phase === 'sort' && state.pivotIdx !== undefined && state.order) {
      const pivot = points[state.pivotIdx];
      ctx.strokeStyle = C_SORT_RAY;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const idx of state.order) {
        const p = points[idx];
        ctx.moveTo(pivot.x, pivot.y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // ---- current stack as polyline (or final hull) ----
    const stackToDraw = (state && state.stack) ? state.stack : hullFinal;
    if (stackToDraw && stackToDraw.length >= 2) {
      ctx.beginPath();
      for (let i = 0; i < stackToDraw.length; i++) {
        const p = points[stackToDraw[i]];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      const isClosed = (state && state.type === 'done') || (!state && hullFinal);
      if (isClosed) {
        ctx.closePath();
        ctx.fillStyle = C_HULL_FILL;
        ctx.fill();
      }
      ctx.strokeStyle = C_HULL;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ---- candidate edge being tested (scan phase) ----
    if (state && state.type === 'scan-test') {
      const O = points[state.second], A = points[state.top], B = points[state.candidate];
      const isPop = state.cross >= 0;
      ctx.strokeStyle = isPop ? C_TEST_POS : C_TEST_NEG;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(O.x, O.y); ctx.lineTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // arc indicator at A showing turn direction
      ctx.strokeStyle = isPop ? C_TEST_POS : C_TEST_NEG;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(A.x, A.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- candidate-consider line: from top of stack to candidate ----
    if (state && (state.type === 'scan-consider' || state.type === 'scan-pop') && state.candidate !== undefined) {
      if (state.stack && state.stack.length >= 1) {
        const top = points[state.stack[state.stack.length - 1]];
        const cand = points[state.candidate];
        ctx.strokeStyle = C_CANDIDATE;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(cand.x, cand.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ---- comparison ray (sort phase) ----
    if (state && (state.type === 'sort-compare' || state.type === 'sort-swap') &&
        state.pivotIdx !== undefined) {
      const pivot = points[state.pivotIdx];
      const isMismatch = state.cross !== undefined && state.cross > 0;
      ctx.strokeStyle = isMismatch ? C_TEST_POS : C_TEST_NEG;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(points[state.aIdx].x, points[state.aIdx].y);
      ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(points[state.bIdx].x, points[state.bIdx].y);
      ctx.stroke();
    }

    // ---- all points ----
    const stackSet = new Set(state && state.stack ? state.stack : (hullFinal || []));
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let color = C_MUTED, size = 4;
      if (state) {
        if (i === state.pivotIdx) { color = C_PIVOT; size = 7; }
        else if (stackSet.has(i)) { color = C_HULL; size = 5; }
        if (state.type === 'sort-compare' || state.type === 'sort-swap') {
          if (i === state.aIdx || i === state.bIdx) {
            color = state.cross > 0 ? C_TEST_POS : C_TEST_NEG;
            size = 6;
          }
        }
        if ((state.type === 'scan-consider' || state.type === 'scan-test' ||
             state.type === 'scan-pop' || state.type === 'scan-push') &&
            i === state.candidate) {
          color = C_CANDIDATE; size = 7;
        }
        if (state.type === 'pivot-consider' && i === state.i) {
          color = C_TEST_POS; size = 6;
        }
      } else {
        // idle - show all points equally
        if (hullFinal && stackSet.has(i)) { color = C_HULL; size = 5; }
      }
      drawPoint(ctx, p.x, p.y, color, size);
    }

    // pivot label on top
    if (state && state.pivotIdx !== undefined) {
      const p = points[state.pivotIdx];
      ctx.fillStyle = C_PIVOT;
      ctx.font = '600 11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('pivot', p.x + 11, p.y);
    }

    // candidate label
    if (state && state.candidate !== undefined &&
        (state.type === 'scan-consider' || state.type === 'scan-test' ||
         state.type === 'scan-pop' || state.type === 'scan-push')) {
      const p = points[state.candidate];
      ctx.fillStyle = C_CANDIDATE;
      ctx.font = '600 11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('candidate', p.x + 11, p.y);
    }

    // cross product overlay during scan-test
    if (state && state.type === 'scan-test') {
      const A = points[state.top];
      const isPop = state.cross >= 0;
      ctx.fillStyle = isPop ? C_TEST_POS : C_TEST_NEG;
      ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const text = (isPop ? 'POP · ' : 'KEEP · ') +
                   'cross = ' + (state.cross > 0 ? '+' : '') + state.cross.toFixed(0);
      ctx.fillText(text, A.x + 18, A.y + 18);
    }
  }

  /* ============================================================ stats UI */

  function updateStats() {
    ptsEl.textContent  = points.length;
    cmpEl.textContent  = stats.cmp;
    popsEl.textContent = stats.pops;
    hsizeEl.textContent = (lastState && lastState.stack) ? lastState.stack.length :
                          (hullFinal ? hullFinal.length : 0);
    if (lastState && lastState.type === 'scan-test') {
      crossEl.innerHTML = '<span class="label">cross</span><span class="cross">' +
                          (lastState.cross > 0 ? '+' : '') + lastState.cross.toFixed(0) +
                          (lastState.cross >= 0 ? ' · pop' : ' · keep') + '</span>';
    } else if (lastState && lastState.type === 'sort-compare') {
      crossEl.innerHTML = '<span class="label">cross</span><span class="cross">' +
                          (lastState.cross > 0 ? '+' : '') + lastState.cross.toFixed(0) + '</span>';
    } else {
      crossEl.innerHTML = '';
    }
  }

  function setPhase(text) {
    phaseEl.textContent = text;
  }

  /* ============================================================ click input */

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.addEventListener('click', (e) => {
    if (running && !paused) return;       // ignore clicks during running animation
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    // de-duplicate identical / very-close points
    for (const p of points) {
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy < 49) return;  // 7px radius dead-zone
    }
    points.push({ x, y });
    if (running) {
      // user clicked while paused - just add
      updateStats();
      render();
      return;
    }
    // idle: clear any prior hull
    hullFinal = null;
    lastState = null;
    setPhase('idle');
    updateStats();
    render();
  });

  /* ============================================================ animation */

  function tick() {
    if (!running || paused || !gen) return;
    let steps = Math.max(1, Math.floor(speed));
    let last = lastState;
    while (steps-- > 0) {
      const r = gen.next();
      if (r.done) {
        if (last && last.type === 'done') {
          hullFinal = last.hull;
        }
        finishRun();
        return;
      }
      last = r.value;
      if (last.type === 'sort-compare') stats.cmp++;
      if (last.type === 'scan-pop')    stats.pops++;
      if (last.phase) setPhase(last.phase);
      if (last.type === 'done') hullFinal = last.hull;
    }
    lastState = last;
    updateStats();
    render();
    requestAnimationFrame(tick);
  }

  function startRun() {
    if (points.length < 3) {
      alert('Drop at least 3 points first.');
      return;
    }
    if (running) return;
    stats = { cmp: 0, pops: 0 };
    hullFinal = null;
    gen = grahamScan(points);
    lastState = null;
    running = true;
    paused = false;
    setPhase('starting');
    updateStats();
    render();
    requestAnimationFrame(tick);
  }

  function finishRun() {
    running = false;
    paused = false;
    gen = null;
    setPhase('done');
    updateStats();
    render();
  }

  function pauseToggle() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) requestAnimationFrame(tick);
  }

  function resetAll() {
    running = false; paused = false; gen = null;
    points = []; hullFinal = null; lastState = null;
    stats = { cmp: 0, pops: 0 };
    pauseBtn.textContent = 'Pause';
    setPhase('idle');
    updateStats();
    render();
  }

  /* ============================================================ presets */

  // Generate point sets in canvas-relative fractions
  function presetPoints(name, w, h) {
    const cx = w * 0.5, cy = h * 0.5;
    const r  = Math.min(w, h) * 0.36;
    const out = [];
    if (name === 'pentagon') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    } else if (name === 'random') {
      // Mulberry32 deterministic
      let s = 0x77ee11ff;
      const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      for (let i = 0; i < 25; i++) {
        out.push({
          x: w * 0.15 + rnd() * w * 0.7,
          y: h * 0.15 + rnd() * h * 0.7,
        });
      }
    } else if (name === 'ring') {
      // outer ring of points, plus a few interior points (lots of pops)
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 12);
        out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      let s = 0xa1b2c3d4;
      const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2;
        const rr = r * 0.55 * rnd();
        out.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
      }
    } else if (name === 'spiral') {
      // points forming a tight spiral - lots of pops during scan
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const a = t * Math.PI * 3;
        const rr = r * (0.25 + 0.7 * t);
        out.push({ x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) });
      }
    }
    return out;
  }

  function loadPreset(name) {
    resetAll();
    const rect = canvas.getBoundingClientRect();
    points = presetPoints(name, rect.width, rect.height);
    updateStats();
    render();
  }

  /* ============================================================ wiring */

  const runBtn   = document.getElementById('run');
  const pauseBtn = document.getElementById('pause');
  const resetBtn = document.getElementById('reset');
  const speedEl  = document.getElementById('speed');
  const speedVal = document.getElementById('speed-value');

  runBtn.addEventListener('click', startRun);
  pauseBtn.addEventListener('click', pauseToggle);
  resetBtn.addEventListener('click', resetAll);
  speedEl.addEventListener('input', () => {
    speed = +speedEl.value;
    speedVal.textContent = speed + '×';
  });

  document.querySelectorAll('.geo-presets [data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(render);
  });

  /* ============================================================ boot */
  // start with a small demo set so the page isn't blank on first load
  setTimeout(() => {
    if (points.length === 0) loadPreset('random');
  }, 50);
})();
