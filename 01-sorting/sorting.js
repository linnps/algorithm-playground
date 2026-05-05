/* ============================================================================
 * Sorting Race
 *
 * Six classic sorting algorithms, each written as an ES6 generator that
 * yields a state snapshot { array, hot, ops, done } at every comparison
 * and swap.  An animation loop drives all enabled algorithms in lockstep
 * and renders each on its own canvas.
 *
 * Palette (read from CSS custom properties at boot):
 *   --title  (blue)   - resting bar colour
 *   --accent (red)    - bar currently being compared/swapped
 *   --muted  (gray)   - bar in already-fixed position
 * ========================================================================== */

(function () {
  "use strict";

  const ROOT = document.documentElement;
  const css = (n) => getComputedStyle(ROOT).getPropertyValue(n).trim();
  const COLOR_BAR  = css("--title")  || "#3B6EA8";
  const COLOR_HOT  = css("--accent") || "#C04040";
  const COLOR_DONE = css("--muted")  || "#7A7A7A";
  const COLOR_BG   = css("--bg-soft")|| "#F7F7F5";

  /* --------------------------------------------------------------- algos */
  // Each generator takes a working array `a` (it's allowed to mutate)
  // and yields { hot: [i, j?] | null, sorted?: number[] }.
  // The driver tracks ops and pulls a snapshot on every yield.

  function* bubbleSort(a) {
    const n = a.length;
    const sorted = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        yield { hot: [j, j + 1], sorted };
        if (a[j] > a[j + 1]) {
          [a[j], a[j + 1]] = [a[j + 1], a[j]];
          yield { hot: [j, j + 1], sorted };
        }
      }
      sorted.push(n - i - 1);
    }
    sorted.push(0);
    yield { hot: null, sorted };
  }

  function* insertionSort(a) {
    const n = a.length;
    const sorted = [0];
    for (let i = 1; i < n; i++) {
      let j = i;
      while (j > 0) {
        yield { hot: [j - 1, j], sorted };
        if (a[j - 1] > a[j]) {
          [a[j - 1], a[j]] = [a[j], a[j - 1]];
          yield { hot: [j - 1, j], sorted };
          j--;
        } else {
          break;
        }
      }
      sorted.push(i);
    }
    yield { hot: null, sorted };
  }

  function* selectionSort(a) {
    const n = a.length;
    const sorted = [];
    for (let i = 0; i < n - 1; i++) {
      let minIdx = i;
      for (let j = i + 1; j < n; j++) {
        yield { hot: [minIdx, j], sorted };
        if (a[j] < a[minIdx]) minIdx = j;
      }
      if (minIdx !== i) {
        [a[i], a[minIdx]] = [a[minIdx], a[i]];
        yield { hot: [i, minIdx], sorted };
      }
      sorted.push(i);
    }
    sorted.push(n - 1);
    yield { hot: null, sorted };
  }

  function* mergeSort(a) {
    const n = a.length;
    function* merge(l, m, r) {
      const left = a.slice(l, m + 1);
      const right = a.slice(m + 1, r + 1);
      let i = 0, j = 0, k = l;
      while (i < left.length && j < right.length) {
        yield { hot: [l + i, m + 1 + j], sorted: [] };
        if (left[i] <= right[j]) { a[k++] = left[i++]; }
        else                     { a[k++] = right[j++]; }
        yield { hot: [k - 1], sorted: [] };
      }
      while (i < left.length)  { a[k++] = left[i++];  yield { hot: [k - 1], sorted: [] }; }
      while (j < right.length) { a[k++] = right[j++]; yield { hot: [k - 1], sorted: [] }; }
    }
    function* sort(l, r) {
      if (l >= r) return;
      const m = (l + r) >> 1;
      yield* sort(l, m);
      yield* sort(m + 1, r);
      yield* merge(l, m, r);
    }
    yield* sort(0, n - 1);
    const all = []; for (let i = 0; i < n; i++) all.push(i);
    yield { hot: null, sorted: all };
  }

  function* quickSort(a) {
    const n = a.length;
    const sorted = new Set();
    function* partition(l, r) {
      const pivot = a[r];
      let i = l - 1;
      for (let j = l; j < r; j++) {
        yield { hot: [j, r], sorted: [...sorted] };
        if (a[j] <= pivot) {
          i++;
          [a[i], a[j]] = [a[j], a[i]];
          yield { hot: [i, j], sorted: [...sorted] };
        }
      }
      [a[i + 1], a[r]] = [a[r], a[i + 1]];
      yield { hot: [i + 1, r], sorted: [...sorted] };
      return i + 1;
    }
    function* sort(l, r) {
      if (l >= r) {
        if (l === r) sorted.add(l);
        return;
      }
      const p = yield* partition(l, r);
      sorted.add(p);
      yield* sort(l, p - 1);
      yield* sort(p + 1, r);
    }
    yield* sort(0, n - 1);
    const all = []; for (let i = 0; i < n; i++) all.push(i);
    yield { hot: null, sorted: all };
  }

  function* heapSort(a) {
    const n = a.length;
    const sorted = [];

    function* siftDown(start, end) {
      let root = start;
      while (root * 2 + 1 <= end) {
        let child = root * 2 + 1;
        if (child + 1 <= end) {
          yield { hot: [child, child + 1], sorted };
          if (a[child] < a[child + 1]) child++;
        }
        yield { hot: [root, child], sorted };
        if (a[root] < a[child]) {
          [a[root], a[child]] = [a[child], a[root]];
          yield { hot: [root, child], sorted };
          root = child;
        } else {
          return;
        }
      }
    }

    // build max-heap
    for (let s = (n - 2) >> 1; s >= 0; s--) {
      yield* siftDown(s, n - 1);
    }
    // sort
    for (let end = n - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      sorted.unshift(end);
      yield { hot: [0, end], sorted };
      yield* siftDown(0, end - 1);
    }
    sorted.unshift(0);
    yield { hot: null, sorted };
  }

  /* --------------------------------------------------------------- catalog */
  const ALGOS = [
    { key: "bubble",    name: "Bubble",    complexity: "O(n²)",        gen: bubbleSort,    enabled: true },
    { key: "insertion", name: "Insertion", complexity: "O(n²)",        gen: insertionSort, enabled: true },
    { key: "selection", name: "Selection", complexity: "O(n²)",        gen: selectionSort, enabled: true },
    { key: "merge",     name: "Merge",     complexity: "O(n log n)",   gen: mergeSort,     enabled: true },
    { key: "quick",     name: "Quick",     complexity: "O(n log n) avg", gen: quickSort,   enabled: true },
    { key: "heap",      name: "Heap",      complexity: "O(n log n)",   gen: heapSort,      enabled: true },
  ];

  /* ------------------------------------------------------------- DOM build */
  const board = document.getElementById("board");
  const checks = document.getElementById("algo-checks");

  ALGOS.forEach((a) => {
    // panel
    const panel = document.createElement("div");
    panel.className = "algo-panel";
    panel.dataset.key = a.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + a.name + ' sort</span>' +
        '<span class="complexity">' + a.complexity + '</span>' +
      '</div>' +
      '<div class="ops">ops <span class="opnum">0</span><span class="done"></span></div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    a.panel  = panel;
    a.canvas = panel.querySelector("canvas");
    a.opnum  = panel.querySelector(".opnum");
    a.donelbl= panel.querySelector(".done");

    // checkbox in controls
    const id = "chk-" + a.key;
    const lab = document.createElement("label");
    lab.innerHTML = '<input type="checkbox" id="' + id + '" checked> ' + a.name;
    checks.appendChild(lab);
    lab.querySelector("input").addEventListener("change", (ev) => {
      a.enabled = ev.target.checked;
      a.panel.classList.toggle("dim", !a.enabled);
    });
  });

  /* ----------------------------------------------------------- canvas init */
  function fitCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function draw(canvas, array, hot, sortedSet) {
    const ctx = canvas.getContext("2d");
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, h);

    const n = array.length;
    const max = Math.max.apply(null, array);
    const barW = w / n;
    for (let i = 0; i < n; i++) {
      const barH = (array[i] / max) * (h - 6);
      let color = COLOR_BAR;
      if (sortedSet && sortedSet.has(i)) color = COLOR_DONE;
      if (hot && hot.indexOf(i) !== -1)  color = COLOR_HOT;
      ctx.fillStyle = color;
      const x = i * barW;
      const y = h - barH;
      ctx.fillRect(x + 0.5, y, Math.max(1, barW - 1), barH);
    }
  }

  /* --------------------------------------------------------------- runner */
  let baseArray = [];   // the canonical input — same for every algo
  let runners = [];     // active per-algo runtime state
  let paused = false;
  let speed = 8;        // generator advances per algorithm per frame
  let rafHandle = null;

  function makeArray(n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.random();
    return out;
  }

  function reset() {
    cancelAnimationFrame(rafHandle);
    const n = +document.getElementById("size").value;
    baseArray = makeArray(n);

    runners = ALGOS.map((a) => {
      const work = baseArray.slice();
      const it = a.gen(work);
      return {
        algo: a,
        work,
        it,
        hot: null,
        sortedSet: new Set(),
        ops: 0,
        done: false,
      };
    });
    runners.forEach((r) => {
      r.algo.opnum.textContent = "0";
      r.algo.donelbl.textContent = "";
      const ctx = fitCanvas(r.algo.canvas);
      draw(r.algo.canvas, r.work, null, r.sortedSet);
    });
    paused = false;
    document.getElementById("pause").textContent = "Pause";
    rafHandle = requestAnimationFrame(tick);
  }

  function tick() {
    if (paused) { rafHandle = null; return; }
    let allDone = true;

    for (const r of runners) {
      if (!r.algo.enabled) continue;
      if (r.done) continue;

      let stepsLeft = speed;
      while (stepsLeft-- > 0 && !r.done) {
        const out = r.it.next();
        if (out.done) {
          r.done = true;
          r.hot = null;
          r.sortedSet = new Set(Array.from({ length: r.work.length }, (_, i) => i));
          break;
        }
        r.ops++;
        const v = out.value;
        r.hot = v.hot || null;
        if (v.sorted) {
          if (Array.isArray(v.sorted))      r.sortedSet = new Set(v.sorted);
          else if (v.sorted instanceof Set) r.sortedSet = v.sorted;
        }
      }
      r.algo.opnum.textContent = r.ops.toLocaleString();
      r.algo.donelbl.textContent = r.done ? "✓ done" : "";
      draw(r.algo.canvas, r.work, r.hot, r.sortedSet);
      if (!r.done) allDone = false;
    }

    if (!allDone) {
      rafHandle = requestAnimationFrame(tick);
    } else {
      rafHandle = null;
    }
  }

  /* --------------------------------------------------------------- wiring */
  const sizeEl  = document.getElementById("size");
  const speedEl = document.getElementById("speed");
  const sizeV   = document.getElementById("size-value");
  const speedV  = document.getElementById("speed-value");
  const resetBtn= document.getElementById("reset");
  const pauseBtn= document.getElementById("pause");

  sizeEl.addEventListener("input", () => {
    sizeV.textContent = sizeEl.value;
  });
  sizeEl.addEventListener("change", () => { reset(); });

  speedEl.addEventListener("input", () => {
    speed = +speedEl.value;
    speedV.textContent = speed + "×";
  });

  resetBtn.addEventListener("click", () => { reset(); });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    if (!paused && !rafHandle) rafHandle = requestAnimationFrame(tick);
  });

  window.addEventListener("resize", () => {
    runners.forEach((r) => {
      fitCanvas(r.algo.canvas);
      draw(r.algo.canvas, r.work, r.hot, r.sortedSet);
    });
  });

  /* --------------------------------------------------------------- launch */
  // wait one tick so layout is stable, then build canvases at correct size
  requestAnimationFrame(reset);
})();
