/* ============================================================================
 * 09-string — KMP vs naive substring matching.
 *
 * Two panels run side-by-side on the same (haystack, needle) pair:
 *
 *   1. **Naive O(nm)** — at every alignment 0..n-m, compare needle to
 *      haystack from left to right; on mismatch, slide needle by one
 *      and restart.
 *
 *   2. **KMP O(n + m)** — first builds a "failure function" for the
 *      needle that records, for every prefix length q, the longest
 *      proper prefix of needle[0..q] that's also a suffix.  Match phase
 *      then never re-examines a haystack character: on mismatch at
 *      position q, jump to fail[q-1] instead of restarting.
 *
 * Stats per panel: comparisons, matches found, phase (build / match).
 * Mismatches flash red; matches flash blue; KMP-jumps flash with arrow.
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
  const C_MATCH    = "#9EB7D6";
  const C_FOUND    = "#3B6EA8";
  const C_HOT      = "#E0B0B0";

  /* ============================================================ algorithms */

  function* naiveMatch(haystack, needle) {
    const n = haystack.length, m = needle.length;
    if (m === 0) { yield { type: "done" }; return; }
    for (let i = 0; i <= n - m; i++) {
      yield { type: "align", anchor: i, q: 0 };
      let j = 0;
      while (j < m) {
        yield { type: "compare", anchor: i, q: j, hi: i + j };
        if (haystack[i + j] !== needle[j]) {
          yield { type: "mismatch", anchor: i, q: j, hi: i + j };
          break;
        }
        yield { type: "match-step", anchor: i, q: j, hi: i + j };
        j++;
      }
      if (j === m) yield { type: "found", anchor: i };
    }
    yield { type: "done" };
  }

  function* kmpMatch(haystack, needle) {
    const n = haystack.length, m = needle.length;
    if (m === 0) { yield { type: "done" }; return; }

    // Phase 1: build failure function
    const fail = new Array(m).fill(0);
    yield { type: "fail-init", fail: fail.slice() };
    let k = 0;
    for (let q = 1; q < m; q++) {
      yield { type: "fail-step-start", q, k, fail: fail.slice() };
      while (k > 0 && needle[k] !== needle[q]) {
        yield { type: "fail-back", q, k, newK: fail[k - 1], fail: fail.slice() };
        k = fail[k - 1];
      }
      if (needle[k] === needle[q]) k++;
      fail[q] = k;
      yield { type: "fail-set", q, value: k, fail: fail.slice() };
    }
    yield { type: "fail-done", fail: fail.slice() };

    // Phase 2: match
    let q = 0;
    for (let i = 0; i < n; i++) {
      yield { type: "compare", hi: i, q, fail: fail.slice() };
      while (q > 0 && needle[q] !== haystack[i]) {
        yield { type: "jump", hi: i, q, newQ: fail[q - 1], fail: fail.slice() };
        q = fail[q - 1];
      }
      if (needle[q] === haystack[i]) {
        yield { type: "match-step", hi: i, q, fail: fail.slice() };
        q++;
      } else {
        yield { type: "mismatch", hi: i, q, fail: fail.slice() };
      }
      if (q === m) {
        yield { type: "found", anchor: i - m + 1, fail: fail.slice() };
        q = fail[q - 1];
      }
    }
    yield { type: "done" };
  }

  /* ============================================================ DOM */
  const ALGOS = [
    { key: "kmp",   name: "KMP",   complexity: "O(n + m) · pre-builds failure function", gen: kmpMatch },
    { key: "naive", name: "Naive", complexity: "O(nm) worst case",                       gen: naiveMatch },
  ];

  const board = document.getElementById("str-board");
  ALGOS.forEach((a) => {
    const panel = document.createElement("div");
    panel.className = "str-panel";
    panel.dataset.key = a.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + a.name + '</span>' +
        '<span class="complexity">' + a.complexity + '</span>' +
      '</div>' +
      '<div class="stats">' +
        '<span><span class="label">phase</span><span class="phase">—</span></span>' +
        '<span><span class="label">comparisons</span><span class="cmp">0</span></span>' +
        '<span><span class="label">matches</span><span class="found">0</span></span>' +
      '</div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    a.canvas = panel.querySelector("canvas");
    a.phaseEl = panel.querySelector(".phase");
    a.cmpEl   = panel.querySelector(".cmp");
    a.foundEl = panel.querySelector(".found");
  });

  /* ============================================================ rendering */

  function fitCanvas(c) {
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = c.getContext("2d");
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return ctx;
  }

  function drawCharCell(ctx, x, y, w, h, ch, fill, stroke, textColor) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = textColor || C_TEXT;
    ctx.font = "700 13px ui-monospace, Menlo, Monaco, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ch, x + w / 2, y + h / 2);
  }

  // Generic renderer. `state` describes the snapshot.
  function renderPanel(canvas, state) {
    const ctx = fitCanvas(canvas);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.fillStyle = C_BG; ctx.fillRect(0, 0, W, H);

    const { haystack, needle, anchor, hi, q, mode, foundPositions, fail, phase } = state;

    const padL = 16;
    const totalCells = haystack.length;
    const cellW = Math.min(28, (W - padL * 2) / totalCells);
    const cellH = 28;

    // ---- ROW 1: index numbers above haystack
    ctx.fillStyle = C_MUTED;
    ctx.font = "9px ui-monospace, Menlo, Monaco, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const indexY = 12;
    for (let i = 0; i < totalCells; i++) {
      if (i % 5 === 0 || i === totalCells - 1) {
        ctx.fillText(String(i), padL + i * cellW + cellW / 2, indexY);
      }
    }

    // ---- ROW 2: haystack
    const haystackY = 18;
    for (let i = 0; i < haystack.length; i++) {
      let fill = "#FFFFFF", stroke = C_LIGHT, textColor = C_TEXT;
      // mark all "found" positions span
      for (const fp of (foundPositions || [])) {
        if (i >= fp && i < fp + needle.length) {
          fill = C_FOUND; textColor = "#FFFFFF";
        }
      }
      if (hi === i && (mode === "compare" || mode === "match-step")) {
        fill = C_MATCH; textColor = "#FFFFFF";
      }
      if (hi === i && mode === "mismatch") { fill = C_HOT; stroke = C_ACCENT; textColor = C_TEXT; }
      drawCharCell(ctx, padL + i * cellW, haystackY, cellW, cellH, haystack[i], fill, stroke, textColor);
    }

    // ---- label "haystack"
    ctx.fillStyle = C_MUTED;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("haystack", padL, haystackY - 4);

    // ---- ROW 3: needle (slid into anchor position)
    const needleY = haystackY + cellH + 12;
    const a = anchor != null ? anchor : 0;
    for (let j = 0; j < needle.length; j++) {
      const x = padL + (a + j) * cellW;
      let fill = "#FFFFFF", stroke = C_LIGHT, textColor = C_TEXT;
      // Already-matched prefix: shade blue
      if (q != null && j < q) { fill = C_MATCH; textColor = "#FFFFFF"; }
      if (q === j && (mode === "compare" || mode === "match-step")) {
        fill = C_MATCH; textColor = "#FFFFFF";
      }
      if (q === j && mode === "mismatch") { fill = C_HOT; stroke = C_ACCENT; textColor = C_TEXT; }
      drawCharCell(ctx, x, needleY, cellW, cellH, needle[j], fill, stroke, textColor);
    }
    ctx.fillStyle = C_MUTED;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("needle", padL, needleY - 4);

    // ---- arrow showing comparison position
    if (q != null && hi != null && (mode === "compare" || mode === "match-step" || mode === "mismatch")) {
      ctx.strokeStyle = (mode === "mismatch") ? C_ACCENT : C_TITLE;
      ctx.lineWidth = 1.4;
      const xH = padL + hi * cellW + cellW / 2;
      const xN = padL + (a + q) * cellW + cellW / 2;
      ctx.beginPath();
      ctx.moveTo(xH, haystackY + cellH);
      ctx.lineTo(xN, needleY);
      ctx.stroke();
    }

    // ---- ROW 4: failure function (KMP only)
    if (fail) {
      const failY = needleY + cellH + 16;
      ctx.fillStyle = C_MUTED;
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText("failure[]", padL, failY - 4);
      for (let j = 0; j < needle.length; j++) {
        const x = padL + (a + j) * cellW;
        const v = fail[j];
        const fill = "#FFFFFF";
        ctx.fillStyle = fill;
        ctx.fillRect(x, failY, cellW, 20);
        ctx.strokeStyle = C_LIGHT;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, failY + 0.5, cellW - 1, 19);
        ctx.fillStyle = (v > 0) ? C_TITLE : C_MUTED;
        ctx.font = "600 11px ui-monospace, Menlo, Monaco, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + cellW / 2, failY + 10);
      }
    }
  }

  /* ============================================================ runner */
  let runners = null;
  let timer = null;
  let paused = false;
  let speed = 8;

  function setup() {
    const haystack = document.getElementById("haystack-input").value || "";
    const needle   = document.getElementById("needle-input").value   || "";
    runners = ALGOS.map((a) => ({
      algo: a,
      it: a.gen(haystack, needle),
      done: false,
      cmp: 0,
      foundPositions: [],
      state: {
        haystack, needle, anchor: 0, hi: null, q: null,
        mode: null, foundPositions: [], fail: null, phase: "—",
      },
    }));
    runners.forEach((r) => {
      r.algo.phaseEl.textContent = "—";
      r.algo.cmpEl.textContent = "0";
      r.algo.foundEl.textContent = "0";
      renderPanel(r.algo.canvas, r.state);
    });
    paused = false;
    document.getElementById("pause").textContent = "Pause";
  }

  function tick() {
    if (paused) { timer = null; return; }
    let allDone = true;
    for (const r of runners) {
      if (r.done) continue;
      let stepsLeft = speed;
      while (stepsLeft-- > 0 && !r.done) {
        const out = r.it.next();
        if (out.done) { r.done = true; break; }
        const v = out.value;
        applyEvent(r, v);
      }
      r.algo.cmpEl.textContent = r.cmp.toLocaleString();
      r.algo.foundEl.textContent = r.foundPositions.length.toString();
      r.algo.foundEl.className = r.foundPositions.length ? "found" : "";
      r.state.foundPositions = r.foundPositions.slice();
      renderPanel(r.algo.canvas, r.state);
      if (!r.done) allDone = false;
    }
    if (!allDone) timer = requestAnimationFrame(tick);
    else timer = null;
  }

  function applyEvent(r, v) {
    if (v.type === "fail-init")        { r.state.phase = "build failure[]"; r.state.fail = v.fail; r.algo.phaseEl.textContent = "build failure[]"; }
    else if (v.type === "fail-step-start") { r.state.q = v.q; r.state.fail = v.fail; r.state.mode = "compare"; r.state.hi = null; }
    else if (v.type === "fail-back")   { r.state.fail = v.fail; r.state.q = v.q; r.cmp++; }
    else if (v.type === "fail-set")    { r.state.fail = v.fail; r.cmp++; }
    else if (v.type === "fail-done")   { r.state.fail = v.fail; r.state.phase = "match"; r.algo.phaseEl.textContent = "match"; r.state.q = null; }
    else if (v.type === "align")       { r.state.phase = "match"; r.algo.phaseEl.textContent = "match"; r.state.anchor = v.anchor; r.state.q = v.q; r.state.hi = null; r.state.mode = null; }
    else if (v.type === "compare")     { r.state.hi = v.hi; r.state.q = v.q; r.state.mode = "compare"; r.cmp++; if (v.fail) r.state.fail = v.fail; }
    else if (v.type === "match-step")  { r.state.hi = v.hi; r.state.q = v.q; r.state.mode = "match-step"; if (v.fail) r.state.fail = v.fail; }
    else if (v.type === "mismatch")    { r.state.hi = v.hi; r.state.q = v.q; r.state.mode = "mismatch"; if (v.fail) r.state.fail = v.fail; }
    else if (v.type === "jump")        { r.state.hi = v.hi; r.state.q = v.newQ; r.state.mode = null; if (v.fail) r.state.fail = v.fail; r.cmp++; }
    else if (v.type === "found")       { r.foundPositions.push(v.anchor); r.state.foundPositions = r.foundPositions.slice(); }
  }

  /* ----------------------------------------------------------- wiring */
  function start() {
    if (timer) cancelAnimationFrame(timer);
    setup();
    timer = requestAnimationFrame(tick);
  }

  document.getElementById("run").addEventListener("click", start);
  document.getElementById("haystack-input").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") start();
  });
  document.getElementById("needle-input").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") start();
  });
  document.getElementById("pause").addEventListener("click", () => {
    paused = !paused;
    document.getElementById("pause").textContent = paused ? "Resume" : "Pause";
    if (!paused && !timer) timer = requestAnimationFrame(tick);
  });
  document.getElementById("speed").addEventListener("input", (ev) => {
    speed = +ev.target.value;
    document.getElementById("speed-value").textContent = speed + "×";
  });

  // Presets
  document.querySelectorAll(".str-presets button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("haystack-input").value = btn.dataset.haystack;
      document.getElementById("needle-input").value   = btn.dataset.needle;
      start();
    });
  });

  window.addEventListener("resize", () => {
    if (runners) for (const r of runners) renderPanel(r.algo.canvas, r.state);
  });

  /* ----------------------------------------------------------- launch */
  requestAnimationFrame(start);
})();
