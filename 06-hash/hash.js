/* ============================================================================
 * 06-hash — chaining vs linear probing vs cuckoo hashing.
 *
 * Three hash tables with the same capacity (N buckets) receive the same
 * stream of integer keys.  They differ in how they resolve collisions.
 * Stats above each panel update live so the visitor can compare:
 *   - load factor
 *   - max chain length (chaining)
 *   - max probe distance (linear probing)
 *   - max eviction chain length (cuckoo)
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
  const C_SLOT_FILL  = "#D8E0EC";
  const C_HOT        = "#E0B0B0";
  const C_HOT_STROKE = C_ACCENT;

  /* ---------------------------------------------------------------- config */
  const N = 16;                     // bucket count per table

  // Knuth multiplicative hash with the golden-ratio constant (good distribution).
  // Bad-hash mode collapses to k % N which is intentionally awful on consecutive keys.
  function goodHash(k, m) {
    // mixing trick that keeps things deterministic in JS without 32-bit integer concerns
    return ((k * 2654435761) >>> 0) % m;
  }
  function badHash(k, m) {
    return ((k % m) + m) % m;
  }
  function altHash(k, m) {
    // second hash for cuckoo
    return ((k * 1779033703) >>> 0) % m;
  }
  let useBadHash = false;
  function H(k, m)  { return useBadHash ? badHash(k, m) : goodHash(k, m); }
  function H2(k, m) { return altHash(k, m); }

  /* ============================================================ chaining */
  class ChainingTable {
    constructor(size) {
      this.size = size;
      this.buckets = new Array(size).fill(null).map(() => []);
      this.count = 0;
    }
    insert(k) {
      const i = H(k, this.size);
      if (this.buckets[i].includes(k)) return { ok: true, hot: [i] };
      this.buckets[i].push(k);
      this.count++;
      return { ok: true, hot: [i] };
    }
    contains(k) { return this.buckets[H(k, this.size)].includes(k); }
    maxChain() {
      let m = 0; for (const b of this.buckets) if (b.length > m) m = b.length;
      return m;
    }
    avgChain() {
      const occ = this.buckets.filter((b) => b.length > 0).length;
      return occ === 0 ? 0 : (this.count / occ);
    }
    loadFactor() { return this.count / this.size; }
  }

  /* =========================================================== probing */
  class ProbingTable {
    constructor(size) {
      this.size = size;
      this.slots = new Array(size).fill(null);   // null = empty
      this.count = 0;
      this.lastProbeChain = [];
    }
    insert(k) {
      if (this.count >= this.size) return { ok: false, hot: [], reason: "table full" };
      let i = H(k, this.size);
      const path = [];
      let probes = 0;
      while (this.slots[i] !== null && this.slots[i] !== k) {
        path.push(i);
        i = (i + 1) % this.size;
        probes++;
        if (probes > this.size) return { ok: false, hot: path, reason: "table full" };
      }
      if (this.slots[i] !== k) {
        this.slots[i] = k;
        this.count++;
      }
      path.push(i);
      this.lastProbeChain = path;
      return { ok: true, hot: path };
    }
    maxProbe() {
      // for each occupied slot, count distance from its hash position to current
      let m = 0;
      for (let i = 0; i < this.size; i++) {
        if (this.slots[i] === null) continue;
        const k = this.slots[i];
        const home = H(k, this.size);
        let d = 0;
        let j = home;
        while (j !== i) { j = (j + 1) % this.size; d++; if (d > this.size) break; }
        if (d > m) m = d;
      }
      return m;
    }
    loadFactor() { return this.count / this.size; }
  }

  /* ========================================================= cuckoo */
  class CuckooTable {
    constructor(size, maxKicks) {
      this.size = size;
      this.t1 = new Array(size).fill(null);
      this.t2 = new Array(size).fill(null);
      this.count = 0;
      this.maxKicksLimit = maxKicks || (2 * size);
      this.lastEvictions = 0;
    }
    insert(k) {
      // already present?
      const i1 = H(k, this.size);
      if (this.t1[i1] === k) return { ok: true, hot: [["1", i1]], evictions: 0 };
      const i2 = H2(k, this.size);
      if (this.t2[i2] === k) return { ok: true, hot: [["2", i2]], evictions: 0 };

      let cur = k, table = 1;
      let evict = 0;
      const hot = [];
      while (evict <= this.maxKicksLimit) {
        if (table === 1) {
          const j = H(cur, this.size);
          hot.push(["1", j]);
          if (this.t1[j] === null) {
            this.t1[j] = cur; this.count++;
            this.lastEvictions = evict;
            return { ok: true, hot, evictions: evict };
          }
          // evict
          const tmp = this.t1[j]; this.t1[j] = cur; cur = tmp;
          table = 2;
        } else {
          const j = H2(cur, this.size);
          hot.push(["2", j]);
          if (this.t2[j] === null) {
            this.t2[j] = cur; this.count++;
            this.lastEvictions = evict;
            return { ok: true, hot, evictions: evict };
          }
          const tmp = this.t2[j]; this.t2[j] = cur; cur = tmp;
          table = 1;
        }
        evict++;
      }
      // failure — needs rehash; for the demo we just refuse and report
      return { ok: false, hot, evictions: evict, reason: "eviction loop > " + this.maxKicksLimit };
    }
    maxEvict() { return this.lastEvictions; }
    loadFactor() { return this.count / (2 * this.size); }   // capacity = 2N
  }

  /* ----------------------------------------------- DOM build */
  const TABLES = [
    {
      key: "chain", name: "Chaining",
      complexity: "O(1) avg · O(n) worst",
      tall: false,
      maker: () => new ChainingTable(N),
    },
    {
      key: "probe", name: "Linear probing",
      complexity: "O(1) avg · clusters bad past 70% load",
      tall: false,
      maker: () => new ProbingTable(N),
    },
    {
      key: "cuckoo", name: "Cuckoo hashing (two tables)",
      complexity: "O(1) worst-case lookup · insert may cascade",
      tall: true,
      maker: () => new CuckooTable(N),
    },
  ];

  const board = document.getElementById("hash-board");
  TABLES.forEach((t) => {
    const panel = document.createElement("div");
    panel.className = "hash-panel" + (t.tall ? " tall" : "");
    panel.dataset.key = t.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + t.name + '</span>' +
        '<span class="complexity">' + t.complexity + '</span>' +
      '</div>' +
      '<div class="stats">' +
        '<span><span class="label">load</span><span class="lf">0.000</span></span>' +
        '<span><span class="label">items</span><span class="cnt">0</span></span>' +
        '<span><span class="label">max</span><span class="metric">0</span></span>' +
        '<span class="status"></span>' +
      '</div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    t.panel    = panel;
    t.canvas   = panel.querySelector("canvas");
    t.lfEl     = panel.querySelector(".lf");
    t.cntEl    = panel.querySelector(".cnt");
    t.metricEl = panel.querySelector(".metric");
    t.statusEl = panel.querySelector(".status");
    t.metricLabel = panel.querySelector(".stats .label:nth-of-type(3)");
    t.table = t.maker();
    t.lastHot = [];
  });

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

  function drawSlot(ctx, x, y, w, h, fill, stroke, label, valueText) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (valueText !== undefined && valueText !== null) {
      ctx.fillStyle = C_TEXT;
      ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(valueText), x + w / 2, y + h / 2);
    }
    if (label !== undefined) {
      ctx.fillStyle = C_MUTED;
      ctx.font = "9px ui-monospace, Menlo, Monaco, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(label, x + w / 2, y + h + 3);
    }
  }

  /* ----------------------------------------------- per-strategy render */
  function renderChaining(canvas, table, hotIdx) {
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, w, h);

    const pad = 12;
    const slotW = (w - 2 * pad) / N;
    const slotH = 30;
    const yTop = 30;

    for (let i = 0; i < N; i++) {
      const x = pad + i * slotW;
      const isHot = hotIdx && hotIdx.includes(i);
      const fill = isHot ? C_HOT : (table.buckets[i].length ? C_SLOT_FILL : "#FFFFFF");
      const stroke = isHot ? C_HOT_STROKE : C_LIGHT;
      drawSlot(ctx, x + 1, yTop, slotW - 2, slotH, fill, stroke, String(i),
               table.buckets[i].length ? table.buckets[i][0] : null);
      // chain elements after the first, drawn as smaller boxes below
      const list = table.buckets[i];
      for (let k = 1; k < list.length; k++) {
        const cy = yTop + slotH + 4 + (k - 1) * 20;
        if (cy + 18 > h - 6) break;
        drawSlot(ctx, x + 4, cy, slotW - 8, 18, "#FFFFFF",
                 isHot ? C_HOT_STROKE : C_LIGHT, undefined, list[k]);
        // small connector tick
        ctx.strokeStyle = C_LIGHT;
        ctx.beginPath();
        ctx.moveTo(x + slotW / 2, cy - 4);
        ctx.lineTo(x + slotW / 2, cy);
        ctx.stroke();
      }
    }
  }

  function renderProbing(canvas, table, hotIdxs) {
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, w, h);

    const pad = 12;
    const slotW = (w - 2 * pad) / N;
    const slotH = 36;
    const yTop = 50;

    for (let i = 0; i < N; i++) {
      const x = pad + i * slotW;
      const isHot = hotIdxs && hotIdxs.includes(i);
      const occupied = table.slots[i] !== null;
      const fill = isHot ? C_HOT : (occupied ? C_SLOT_FILL : "#FFFFFF");
      const stroke = isHot ? C_HOT_STROKE : C_LIGHT;
      drawSlot(ctx, x + 1, yTop, slotW - 2, slotH, fill, stroke, String(i),
               occupied ? table.slots[i] : null);
      // distance-from-home indicator (small dot if probed past home)
      if (occupied) {
        const home = H(table.slots[i], N);
        if (home !== i) {
          ctx.fillStyle = C_ACCENT;
          ctx.beginPath();
          ctx.arc(x + slotW - 5, yTop + 4, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    // tiny legend
    ctx.fillStyle = C_MUTED;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("• red dot = key was placed past its hash position (probed)", pad, 24);
  }

  function renderCuckoo(canvas, table, hot) {
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, w, h);

    const pad = 12;
    const slotW = (w - 2 * pad) / N;
    const slotH = 36;

    function tableLabel(text, y) {
      ctx.fillStyle = C_MUTED;
      ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(text, pad, y);
    }

    tableLabel("Table 1 (hash h₁)", 24);
    const y1 = 32;
    for (let i = 0; i < N; i++) {
      const x = pad + i * slotW;
      const isHot = hot && hot.some(([t, idx]) => t === "1" && idx === i);
      const occupied = table.t1[i] !== null;
      const fill = isHot ? C_HOT : (occupied ? C_SLOT_FILL : "#FFFFFF");
      const stroke = isHot ? C_HOT_STROKE : C_LIGHT;
      drawSlot(ctx, x + 1, y1, slotW - 2, slotH, fill, stroke, String(i),
               occupied ? table.t1[i] : null);
    }

    tableLabel("Table 2 (hash h₂)", y1 + slotH + 30);
    const y2 = y1 + slotH + 38;
    for (let i = 0; i < N; i++) {
      const x = pad + i * slotW;
      const isHot = hot && hot.some(([t, idx]) => t === "2" && idx === i);
      const occupied = table.t2[i] !== null;
      const fill = isHot ? C_HOT : (occupied ? C_SLOT_FILL : "#FFFFFF");
      const stroke = isHot ? C_HOT_STROKE : C_LIGHT;
      drawSlot(ctx, x + 1, y2, slotW - 2, slotH, fill, stroke, String(i),
               occupied ? table.t2[i] : null);
    }
  }

  function renderAll() {
    for (const t of TABLES) {
      if (t.key === "chain")  renderChaining(t.canvas, t.table, t.lastHot);
      if (t.key === "probe")  renderProbing(t.canvas, t.table, t.lastHot);
      if (t.key === "cuckoo") renderCuckoo(t.canvas, t.table, t.lastHot);
    }
  }

  /* ----------------------------------------------- stats refresh */
  function refreshStats() {
    for (const t of TABLES) {
      const lf = t.table.loadFactor();
      t.lfEl.textContent = lf.toFixed(3);
      t.cntEl.textContent = t.table.count.toString();
      let metric = 0, metricName = "max";
      let className = "metric";
      if (t.key === "chain")  { metric = t.table.maxChain();  metricName = "longest chain"; }
      if (t.key === "probe")  { metric = t.table.maxProbe();  metricName = "longest probe"; }
      if (t.key === "cuckoo") { metric = t.table.maxEvict();  metricName = "last evictions"; }
      t.metricEl.textContent = metric.toString();
      t.metricEl.previousElementSibling.textContent = metricName;
      // status badge
      if (t.key === "probe" && lf >= 0.85) {
        t.statusEl.textContent = "clusters severe";
        t.statusEl.className = "warn";
      } else if (t.key === "cuckoo" && lf > 0.45) {
        t.statusEl.textContent = lf > 0.5 ? "near rehash" : "load high";
        t.statusEl.className = "warn";
      } else if (t.lastFail) {
        t.statusEl.textContent = "INSERT FAILED · " + t.lastFail;
        t.statusEl.className = "fail";
        t.lastFail = null;
      } else {
        t.statusEl.textContent = "";
        t.statusEl.className = "";
      }
    }
  }

  /* ----------------------------------------------- key generation */
  let usedKeys = new Set();
  function nextRandomKey() {
    // small range (0..199) so collisions happen on a 16-bucket table
    let tries = 0;
    while (tries < 500) {
      const k = Math.floor(Math.random() * 200);
      if (!usedKeys.has(k)) { usedKeys.add(k); return k; }
      tries++;
    }
    return null;
  }

  function insertOne(k) {
    if (k == null) return;
    for (const t of TABLES) {
      const r = t.table.insert(k);
      t.lastHot = (t.key === "cuckoo") ? r.hot : (r.hot || []);
      if (!r.ok) t.lastFail = r.reason;
    }
    refreshStats();
    renderAll();
  }

  function insertN(n) {
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const k = nextRandomKey();
      if (k == null) return inserted;
      insertOne(k);
      inserted++;
    }
    return inserted;
  }

  function reset() {
    for (const t of TABLES) {
      t.table = t.maker();
      t.lastHot = [];
      t.lastFail = null;
    }
    usedKeys = new Set();
    refreshStats();
    renderAll();
  }

  /* ----------------------------------------------- wiring */
  document.getElementById("add1").addEventListener("click",   () => insertN(1));
  document.getElementById("add5").addEventListener("click",   () => insertN(5));
  document.getElementById("addToLF").addEventListener("click", () => {
    const target = +document.getElementById("lf-target").value / 100;
    let safety = 1000;
    while (safety-- > 0) {
      // each panel may have its own load factor — drive by the chaining table
      const cur = TABLES[0].table.loadFactor();
      if (cur >= target) break;
      const ok = insertN(1) > 0;
      if (!ok) break;
    }
  });
  document.getElementById("reset").addEventListener("click", reset);

  document.getElementById("lf-target").addEventListener("input", (ev) => {
    document.getElementById("lf-target-value").textContent = (+ev.target.value).toFixed(0) + "%";
  });

  document.getElementById("bad-hash").addEventListener("change", (ev) => {
    useBadHash = ev.target.checked;
    reset();
  });

  window.addEventListener("resize", () => renderAll());

  /* ----------------------------------------------- launch */
  requestAnimationFrame(() => {
    renderAll();
    refreshStats();
    insertN(8);                        // start with 8 random keys
  });
})();
