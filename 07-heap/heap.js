/* ============================================================================
 * 07-heap — binary max-heap operations + heapsort vs quicksort race
 *
 * Two sections on the page:
 *
 * 1. **Heap operations** — single max-heap visualised both as a tree
 *    (top half of canvas) and as an array (bottom half).  Insert / extract
 *    operations animate sift-up / sift-down in lockstep across both views,
 *    with the active node ringed in red on each frame.
 *
 * 2. **Heapsort vs Quicksort** — same starting array, two panels, animated
 *    bar race.  Heapsort builds a heap then repeatedly extracts max;
 *    quicksort does standard Lomuto partitioning.
 *
 * Heap layout: a binary heap is a complete binary tree, so we can derive
 * each node's (x, y) directly from its array index:
 *     depth d = floor(log2(i + 1))
 *     position-in-row p = (i + 1) − 2^d
 *     x = (p + 0.5) × (width / 2^d)
 *     y = (d + 0.5) × (height / max_depth)
 * This packs each level evenly across the canvas.
 * ========================================================================== */

(function () {
  "use strict";

  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_BG       = css("--bg-soft", "#F7F7F5");
  const C_GRID     = css("--grid",    "#E5E5E5");
  const C_LIGHT    = css("--light",   "#CCCCCC");
  const C_TEXT     = css("--text",    "#333333");
  const C_TITLE    = css("--title",   "#3B6EA8");
  const C_ACCENT   = css("--accent",  "#C04040");
  const C_MUTED    = css("--muted",   "#7A7A7A");
  const C_FILL     = "#D8E0EC";

  /* ============================================================== heap */
  class MaxHeap {
    constructor() { this.arr = []; }
    size() { return this.arr.length; }
    peek() { return this.arr[0]; }

    *insert(k) {
      this.arr.push(k);
      let i = this.arr.length - 1;
      yield { type: "place", at: i };
      while (i > 0) {
        const parent = (i - 1) >> 1;
        yield { type: "compare", a: i, b: parent };
        if (this.arr[i] > this.arr[parent]) {
          [this.arr[i], this.arr[parent]] = [this.arr[parent], this.arr[i]];
          yield { type: "swap", a: i, b: parent };
          i = parent;
        } else break;
      }
      yield { type: "done" };
    }

    *extractMax() {
      if (!this.arr.length) { yield { type: "done", extracted: null }; return; }
      const max = this.arr[0];
      yield { type: "remove-root", value: max };
      const last = this.arr.pop();
      if (this.arr.length) {
        this.arr[0] = last;
        yield { type: "place", at: 0 };
        yield* this._siftDown(0);
      }
      yield { type: "done", extracted: max };
    }

    *_siftDown(i) {
      const n = this.arr.length;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let largest = i;
        if (l < n) {
          yield { type: "compare", a: i, b: l };
          if (this.arr[l] > this.arr[largest]) largest = l;
        }
        if (r < n) {
          yield { type: "compare", a: largest, b: r };
          if (this.arr[r] > this.arr[largest]) largest = r;
        }
        if (largest === i) break;
        [this.arr[i], this.arr[largest]] = [this.arr[largest], this.arr[i]];
        yield { type: "swap", a: i, b: largest };
        i = largest;
      }
    }
  }

  /* ----------------------------------------------- canvas helpers */
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return ctx;
  }

  /* ============================================================== heap render */
  // Render heap.arr[] both as tree (top) and array (bottom) on a single canvas.
  function renderHeap(canvas, heap, hot) {
    const ctx = fitCanvas(canvas);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, W, H);

    const n = heap.size();
    if (n === 0) {
      ctx.fillStyle = C_MUTED;
      ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("(heap empty — insert a value to begin)", W / 2, H / 2);
      return;
    }

    const arrayH = 50;
    const treeH  = H - arrayH - 16;       // 16 = gap

    // ---- compute tree positions
    const maxDepth = Math.floor(Math.log2(n));
    const positions = new Array(n);
    for (let i = 0; i < n; i++) {
      const d = Math.floor(Math.log2(i + 1));
      const p = (i + 1) - (1 << d);
      const rowSize = 1 << d;
      const x = ((p + 0.5) / rowSize) * (W - 40) + 20;
      const y = ((d + 0.5) / (maxDepth + 1)) * treeH + 10;
      positions[i] = { x, y };
    }

    // ---- draw tree edges
    ctx.strokeStyle = C_MUTED; ctx.lineWidth = 1.2;
    for (let i = 1; i < n; i++) {
      const parent = (i - 1) >> 1;
      const pa = positions[parent], pb = positions[i];
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }

    // ---- draw nodes
    const nodeR = 14;
    for (let i = 0; i < n; i++) {
      const p = positions[i];
      const isHot = hot && hot.has(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, nodeR, 0, 2 * Math.PI);
      ctx.fillStyle = isHot ? "#E0B0B0" : C_FILL;
      ctx.fill();
      ctx.strokeStyle = isHot ? C_ACCENT : C_LIGHT;
      ctx.lineWidth = isHot ? 1.6 : 1.0;
      ctx.stroke();

      ctx.fillStyle = C_TEXT;
      ctx.font = "700 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(heap.arr[i]), p.x, p.y);
    }

    // ---- draw array (bottom strip)
    const arrayY = H - arrayH;
    const slotMaxN = Math.max(n, 16);
    const slotW = (W - 40) / slotMaxN;
    const slotH = 32;
    for (let i = 0; i < n; i++) {
      const x = 20 + i * slotW;
      const y = arrayY + 4;
      const isHot = hot && hot.has(i);
      ctx.fillStyle = isHot ? "#E0B0B0" : "#FFFFFF";
      ctx.strokeStyle = isHot ? C_ACCENT : C_LIGHT;
      ctx.lineWidth = isHot ? 1.4 : 1.0;
      ctx.fillRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);
      ctx.strokeRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);
      ctx.fillStyle = C_TEXT;
      ctx.font = "700 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(heap.arr[i]), x + slotW / 2, y + slotH / 2);
      // index label
      ctx.fillStyle = C_MUTED;
      ctx.font = "9px ui-monospace, Menlo, Monaco, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(String(i), x + slotW / 2, y + slotH + 2);
    }
    // label
    ctx.fillStyle = C_MUTED;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("array storage  ←  same data, linear view", 20, arrayY - 2);
  }

  /* ============================================================== Section 1 wiring */
  const heap = new MaxHeap();
  const heapCanvas = document.getElementById("heap-canvas");
  const heapInput  = document.getElementById("heap-input");
  const heapStats  = {
    size: document.getElementById("heap-size"),
    max:  document.getElementById("heap-max"),
    ops:  document.getElementById("heap-ops"),
    last: document.getElementById("heap-last"),
  };

  let opCount = 0;
  let opTimer = null;
  let opHot = new Set();

  function refreshStats(lastResult) {
    heapStats.size.textContent = heap.size();
    heapStats.max.textContent  = heap.size() ? heap.peek() : "—";
    heapStats.ops.textContent  = opCount;
    if (lastResult !== undefined) heapStats.last.textContent = lastResult;
  }

  function animateGen(gen, onDone) {
    if (opTimer) clearInterval(opTimer);
    const speed = +document.getElementById("heap-speed").value;
    const interval = Math.max(40, Math.round(1000 / speed));
    opTimer = setInterval(() => {
      const out = gen.next();
      if (out.done) {
        clearInterval(opTimer); opTimer = null;
        opHot.clear();
        renderHeap(heapCanvas, heap, opHot);
        if (onDone) onDone();
        return;
      }
      const v = out.value;
      opHot.clear();
      if (v.type === "compare") { opHot.add(v.a); opHot.add(v.b); opCount++; }
      else if (v.type === "swap") { opHot.add(v.a); opHot.add(v.b); opCount++; }
      else if (v.type === "place") { opHot.add(v.at); }
      else if (v.type === "remove-root") { opHot.add(0); }
      renderHeap(heapCanvas, heap, opHot);
      refreshStats();
    }, interval);
  }

  document.getElementById("heap-insert").addEventListener("click", () => {
    if (opTimer) return;
    const v = parseInt(heapInput.value, 10);
    if (!Number.isFinite(v)) return;
    heapInput.value = "";
    opCount = 0;
    animateGen(heap.insert(v), () => refreshStats("inserted " + v + " · " + opCount + " ops"));
  });
  heapInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") document.getElementById("heap-insert").click();
  });

  document.getElementById("heap-extract").addEventListener("click", () => {
    if (opTimer) return;
    if (heap.size() === 0) { refreshStats("(empty)"); return; }
    opCount = 0;
    animateGen(heap.extractMax(), () => refreshStats("extracted · " + opCount + " ops"));
  });

  document.getElementById("heap-random10").addEventListener("click", () => {
    if (opTimer) return;
    // bulk insert without animation, then redraw
    for (let i = 0; i < 10; i++) heap.arr.push(Math.floor(Math.random() * 100));
    // heapify (Floyd's bottom-up)
    for (let i = (heap.size() >> 1) - 1; i >= 0; i--) {
      // synchronously consume the sift-down generator
      const g = heap._siftDown(i);
      while (!g.next().done) {}
    }
    opHot.clear();
    refreshStats("seeded 10 random keys (heapified)");
    renderHeap(heapCanvas, heap, opHot);
  });

  document.getElementById("heap-clear").addEventListener("click", () => {
    if (opTimer) { clearInterval(opTimer); opTimer = null; }
    heap.arr = []; opHot.clear(); opCount = 0;
    refreshStats("cleared");
    renderHeap(heapCanvas, heap, opHot);
  });

  /* ============================================================== Section 2: race */
  const RACE_N = 28;
  let raceArr = [];
  function newRaceArr() {
    raceArr = [];
    for (let i = 0; i < RACE_N; i++) raceArr.push(Math.random());
  }
  newRaceArr();

  // heapsort
  function* heapsortGen(a) {
    const sorted = new Set();
    function* sd(start, end) {
      let root = start;
      while (root * 2 + 1 <= end) {
        let child = root * 2 + 1;
        if (child + 1 <= end) {
          yield { hot: [child, child + 1], sorted: [...sorted] };
          if (a[child] < a[child + 1]) child++;
        }
        yield { hot: [root, child], sorted: [...sorted] };
        if (a[root] < a[child]) {
          [a[root], a[child]] = [a[child], a[root]];
          yield { hot: [root, child], sorted: [...sorted] };
          root = child;
        } else return;
      }
    }
    for (let s = (a.length - 2) >> 1; s >= 0; s--) yield* sd(s, a.length - 1);
    for (let end = a.length - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      sorted.add(end);
      yield { hot: [0, end], sorted: [...sorted] };
      yield* sd(0, end - 1);
    }
    sorted.add(0);
    yield { hot: null, sorted: [...sorted] };
  }
  // quicksort
  function* quicksortGen(a) {
    const sorted = new Set();
    function* part(l, r) {
      const piv = a[r];
      let i = l - 1;
      for (let j = l; j < r; j++) {
        yield { hot: [j, r], sorted: [...sorted] };
        if (a[j] <= piv) { i++; [a[i], a[j]] = [a[j], a[i]];
                            yield { hot: [i, j], sorted: [...sorted] }; }
      }
      [a[i + 1], a[r]] = [a[r], a[i + 1]];
      yield { hot: [i + 1, r], sorted: [...sorted] };
      return i + 1;
    }
    function* qs(l, r) {
      if (l >= r) { if (l === r) sorted.add(l); return; }
      const p = yield* part(l, r);
      sorted.add(p);
      yield* qs(l, p - 1);
      yield* qs(p + 1, r);
    }
    yield* qs(0, a.length - 1);
    yield { hot: null, sorted: Array.from({ length: a.length }, (_, i) => i) };
  }

  const RACERS = [
    { key: "heap",  name: "Heapsort",   complexity: "O(n log n) worst",       gen: heapsortGen, },
    { key: "quick", name: "Quicksort",  complexity: "O(n log n) avg · O(n²)", gen: quicksortGen, },
  ];

  const board = document.getElementById("race-board");
  RACERS.forEach((r) => {
    const panel = document.createElement("div");
    panel.className = "race-panel";
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + r.name + '</span>' +
        '<span class="complexity">' + r.complexity + '</span>' +
      '</div>' +
      '<div class="ops">ops <span class="opnum">0</span><span class="done"></span></div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    r.canvas = panel.querySelector("canvas");
    r.opnum  = panel.querySelector(".opnum");
    r.donelbl= panel.querySelector(".done");
  });

  function drawRace(canvas, arr, hot, sortedSet) {
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, w, h);
    const max = Math.max.apply(null, arr) || 1;
    const barW = w / arr.length;
    for (let i = 0; i < arr.length; i++) {
      const barH = (arr[i] / max) * (h - 4);
      let color = C_TITLE;
      if (sortedSet && sortedSet.has(i)) color = C_MUTED;
      if (hot && hot.includes(i)) color = C_ACCENT;
      ctx.fillStyle = color;
      ctx.fillRect(i * barW + 0.5, h - barH, Math.max(1, barW - 1), barH);
    }
  }

  let raceState = null;
  let raceTimer = null;
  function startRace() {
    cancelAnimationFrame(raceTimer);
    if (raceTimer) raceTimer = null;
    newRaceArr();
    raceState = RACERS.map((r) => ({
      racer: r,
      work: raceArr.slice(),
      it: r.gen(raceArr.slice()).constructor === Function
            ? r.gen.call(null, raceArr.slice())
            : r.gen(raceArr.slice()),
      ops: 0, done: false, hot: null, sortedSet: new Set(),
    }));
    // Note: each racer needs its own copy of the array.
    raceState = RACERS.map((r) => {
      const arrCopy = raceArr.slice();
      return {
        racer: r,
        work: arrCopy,
        it: r.gen(arrCopy),
        ops: 0, done: false, hot: null, sortedSet: new Set(),
      };
    });
    RACERS.forEach((r) => {
      r.opnum.textContent = "0";
      r.donelbl.textContent = "";
    });
    raceTimer = requestAnimationFrame(raceTick);
  }

  function raceTick() {
    const speed = +document.getElementById("race-speed").value;
    let allDone = true;
    for (const s of raceState) {
      if (s.done) continue;
      let stepsLeft = speed;
      while (stepsLeft-- > 0 && !s.done) {
        const out = s.it.next();
        if (out.done) {
          s.done = true;
          // mark every index as sorted at end
          s.sortedSet = new Set(Array.from({ length: s.work.length }, (_, i) => i));
          break;
        }
        s.ops++;
        const v = out.value;
        s.hot = v.hot || null;
        if (v.sorted) {
          if (Array.isArray(v.sorted)) s.sortedSet = new Set(v.sorted);
          else if (v.sorted instanceof Set) s.sortedSet = v.sorted;
        }
      }
      s.racer.opnum.textContent = s.ops.toLocaleString();
      s.racer.donelbl.textContent = s.done ? "✓ done" : "";
      drawRace(s.racer.canvas, s.work, s.hot, s.sortedSet);
      if (!s.done) allDone = false;
    }
    if (!allDone) raceTimer = requestAnimationFrame(raceTick);
    else raceTimer = null;
  }

  document.getElementById("race-restart").addEventListener("click", startRace);

  /* ----------------------------------------------------------- launch */
  window.addEventListener("resize", () => {
    renderHeap(heapCanvas, heap, opHot);
    if (raceState) {
      for (const s of raceState) drawRace(s.racer.canvas, s.work, s.hot, s.sortedSet);
    }
  });

  requestAnimationFrame(() => {
    // Seed heap section with a small heap so it's not empty
    for (const k of [42, 17, 88, 55, 23, 9, 71]) {
      const g = heap.insert(k);
      while (!g.next().done) {}
    }
    refreshStats("seeded with 7 keys");
    renderHeap(heapCanvas, heap, opHot);

    startRace();
  });
})();
