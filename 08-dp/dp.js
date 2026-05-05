/* ============================================================================
 * 08-dp — Dynamic programming visualiser
 *
 * Three classic DP problems share the same renderer:
 *   - Longest Common Subsequence
 *   - Edit (Levenshtein) Distance
 *   - 0/1 Knapsack
 *
 * Each problem is an ES6 generator that yields:
 *   { type: 'fill', r, c, value, dp }   — table cell just computed
 *   { type: 'trace', path }              — traceback path (rendered red)
 *   { type: 'done',  value, path }       — final answer
 *
 * The DP table is a 2-D grid drawn on a single canvas, with row / column
 * headers (characters or item indices), cell-by-cell colour fill (gradient
 * blue keyed to value), and a final traceback overlay in red.
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

  // value-to-colour gradient (light → deep blue)
  const RAMP = ["#FFFFFF", "#EAEFF7", "#D8E0EC", "#9EB7D6", "#5A8FCC", "#3B6EA8", "#1F4670"];
  function rampColor(v, max) {
    if (max <= 0) return RAMP[0];
    const t = Math.min(1, v / max);
    const idx = Math.min(RAMP.length - 1, Math.floor(t * (RAMP.length - 0.001)));
    return RAMP[idx];
  }
  function textOnRamp(v, max) {
    return v / Math.max(1, max) > 0.5 ? "#FFFFFF" : C_TEXT;
  }

  /* ============================================================ algorithms */

  /* ----------------------------- LCS ---------------------------- */
  function* lcsGen(A, B) {
    const m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= n; j++) {
        if (i === 0 || j === 0) dp[i][j] = 0;
        else if (A[i - 1] === B[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        yield { type: "fill", r: i, c: j, value: dp[i][j], dp };
      }
    }
    // traceback
    const path = [];
    let lcsStr = "";
    let i = m, j = n;
    while (i > 0 && j > 0) {
      path.push({ r: i, c: j });
      if (A[i - 1] === B[j - 1]) { lcsStr = A[i - 1] + lcsStr; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
      yield { type: "trace", path: path.slice() };
    }
    yield { type: "done", value: dp[m][n], answerLabel: "LCS length",
            extra: lcsStr ? "subsequence: \"" + lcsStr + "\"" : "" };
  }

  /* ----------------------------- Edit distance ------------------------- */
  function* editGen(A, B) {
    const m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= n; j++) {
        if (i === 0)      dp[i][j] = j;
        else if (j === 0) dp[i][j] = i;
        else if (A[i - 1] === B[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(
          dp[i - 1][j - 1],     // substitute
          dp[i - 1][j],         // delete from A
          dp[i][j - 1]          // insert into A
        );
        yield { type: "fill", r: i, c: j, value: dp[i][j], dp };
      }
    }
    // traceback through min-cost preds
    const path = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      path.push({ r: i, c: j });
      if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) { i--; j--; }
      else {
        const sub = (i > 0 && j > 0) ? dp[i - 1][j - 1] : Infinity;
        const del = i > 0 ? dp[i - 1][j] : Infinity;
        const ins = j > 0 ? dp[i][j - 1] : Infinity;
        const m_ = Math.min(sub, del, ins);
        if (sub === m_)      { i--; j--; }
        else if (del === m_) i--;
        else                 j--;
      }
      yield { type: "trace", path: path.slice() };
    }
    yield { type: "done", value: dp[m][n], answerLabel: "edits", extra: "" };
  }

  /* ----------------------------- 0/1 Knapsack ------------------------- */
  function* knapsackGen(weights, values, W) {
    const n = weights.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));
    for (let i = 0; i <= n; i++) {
      for (let w = 0; w <= W; w++) {
        if (i === 0 || w === 0) dp[i][w] = 0;
        else if (weights[i - 1] > w) dp[i][w] = dp[i - 1][w];
        else dp[i][w] = Math.max(dp[i - 1][w],
                                  dp[i - 1][w - weights[i - 1]] + values[i - 1]);
        yield { type: "fill", r: i, c: w, value: dp[i][w], dp };
      }
    }
    // traceback: which items were chosen?
    const path = [];
    const taken = [];
    let i = n, w = W;
    while (i > 0 && w > 0) {
      path.push({ r: i, c: w });
      if (dp[i][w] !== dp[i - 1][w]) {
        taken.push(i - 1);              // 0-indexed item id
        w -= weights[i - 1];
      }
      i--;
      yield { type: "trace", path: path.slice() };
    }
    while (i > 0) { path.push({ r: i, c: w }); i--; yield { type: "trace", path: path.slice() }; }
    yield { type: "done", value: dp[n][W], answerLabel: "max value",
            extra: taken.length ? "items: " + taken.sort((a,b)=>a-b).map((k) => "#" + (k+1)).join(", ") : "no items fit" };
  }

  /* ============================================================ DOM */
  const canvas   = document.getElementById("dp-canvas");
  const select   = document.getElementById("dp-problem");
  const inputs   = {
    A: document.getElementById("dp-A"),
    B: document.getElementById("dp-B"),
    weights: document.getElementById("dp-weights"),
    values:  document.getElementById("dp-values"),
    W:       document.getElementById("dp-W"),
  };
  const inputBoxes = {
    strings:   document.getElementById("dp-input-strings"),
    knapsack:  document.getElementById("dp-input-knapsack"),
  };
  const answerEl = document.getElementById("dp-answer");
  const sectionTitle = document.getElementById("dp-section-title");

  function setProblem() {
    const p = select.value;
    if (p === "knapsack") {
      inputBoxes.strings.style.display  = "none";
      inputBoxes.knapsack.style.display = "flex";
    } else {
      inputBoxes.strings.style.display  = "flex";
      inputBoxes.knapsack.style.display = "none";
    }
    if (p === "lcs")        sectionTitle.textContent = "Longest Common Subsequence";
    else if (p === "edit")  sectionTitle.textContent = "Edit Distance (Levenshtein)";
    else if (p === "knapsack") sectionTitle.textContent = "0/1 Knapsack";
  }
  select.addEventListener("change", setProblem);

  /* ============================================================ rendering */

  // Common renderer for fill state.
  function renderTable(state) {
    const ctx = fitCanvas(canvas);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    const { dp, problem, A, B, weights, values, capacity, hot, path } = state;

    const rows = dp.length;
    const cols = dp[0].length;
    const headerRowH = 22;
    const headerColW = 36;
    const padTop = 16;
    const padLeft = 4;

    const tableW = W - padLeft - 4;
    const tableH = H - padTop - 4 - headerRowH;
    const cellW = (tableW - headerColW) / cols;
    const cellH = (tableH - headerRowH) / rows;

    // compute max value for colour scaling
    let maxV = 0;
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        if (dp[i][j] > maxV) maxV = dp[i][j];

    // ---- column header (top edge: B chars or weight w values)
    ctx.fillStyle = C_MUTED;
    ctx.font = "11px ui-monospace, Menlo, Monaco, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let j = 0; j < cols; j++) {
      const x = padLeft + headerColW + j * cellW;
      const yc = padTop + headerRowH / 2;
      let text;
      if (problem === "knapsack") {
        text = String(j);                                 // capacity 0..W
      } else {
        text = j === 0 ? "ε" : (B[j - 1] || "");
      }
      ctx.fillText(text, x + cellW / 2, yc);
    }

    // ---- row header (left edge: A chars or item indices)
    for (let i = 0; i < rows; i++) {
      const y = padTop + headerRowH + i * cellH;
      const xc = padLeft + headerColW / 2;
      let text;
      if (problem === "knapsack") {
        text = i === 0 ? "∅" : "i" + i;
      } else {
        text = i === 0 ? "ε" : (A[i - 1] || "");
      }
      ctx.fillText(text, xc, y + cellH / 2);
    }

    // ---- cells
    const tracedSet = new Set();
    if (path) {
      for (const p of path) tracedSet.add(p.r + "," + p.c);
    }

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const v = dp[i][j];
        const x = padLeft + headerColW + j * cellW;
        const y = padTop + headerRowH + i * cellH;
        // background
        let fill = (i === 0 || j === 0) ? "#FFFFFF" : rampColor(v, maxV);
        const isHot   = hot && hot.r === i && hot.c === j;
        const isTrace = tracedSet.has(i + "," + j);
        if (isTrace) fill = C_ACCENT;
        if (isHot && !isTrace) fill = "#E0B0B0";
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = C_LIGHT;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

        // value
        let textColor;
        if (isTrace)        textColor = "#FFFFFF";
        else if (isHot)     textColor = C_TEXT;
        else                textColor = textOnRamp(v, maxV);
        ctx.fillStyle = textColor;
        ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(v), x + cellW / 2, y + cellH / 2);
      }
    }

    // ---- emphasise final answer cell with accent border
    if (state.done) {
      const x = padLeft + headerColW + (cols - 1) * cellW;
      const y = padTop + headerRowH + (rows - 1) * cellH;
      ctx.strokeStyle = C_ACCENT;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
  }

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

  /* ============================================================ runner */
  let timer = null;
  let runState = null;

  function reset() {
    if (timer) { clearInterval(timer); timer = null; }
    runState = null;
    const ctx = fitCanvas(canvas);
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    answerEl.innerHTML = '<span class="pending">click "Run" to fill the DP table</span>';
  }

  function start() {
    reset();
    const p = select.value;
    let gen, problemMeta;
    if (p === "lcs") {
      const A = (inputs.A.value || "").trim();
      const B = (inputs.B.value || "").trim();
      gen = lcsGen(A, B);
      problemMeta = { problem: "lcs", A, B };
    } else if (p === "edit") {
      const A = (inputs.A.value || "").trim();
      const B = (inputs.B.value || "").trim();
      gen = editGen(A, B);
      problemMeta = { problem: "edit", A, B };
    } else if (p === "knapsack") {
      const weights = inputs.weights.value.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter(Number.isFinite);
      const values  = inputs.values.value.split(/[\s,]+/).map((s) => parseInt(s, 10)).filter(Number.isFinite);
      const W = parseInt(inputs.W.value, 10) || 0;
      if (weights.length !== values.length) {
        answerEl.innerHTML = '<span class="pending" style="color:var(--accent)">weights and values must have the same length</span>';
        return;
      }
      if (weights.length === 0) {
        answerEl.innerHTML = '<span class="pending" style="color:var(--accent)">need at least one item</span>';
        return;
      }
      gen = knapsackGen(weights, values, W);
      problemMeta = { problem: "knapsack", weights, values, capacity: W };
    }

    runState = {
      gen,
      ...problemMeta,
      dp: null,
      hot: null,
      path: null,
      done: false,
    };

    const speed = +document.getElementById("dp-speed").value;
    const interval = Math.max(8, Math.round(400 / speed));
    timer = setInterval(() => {
      const out = runState.gen.next();
      if (out.done) {
        clearInterval(timer); timer = null;
        return;
      }
      const v = out.value;
      if (v.type === "fill") {
        runState.dp = v.dp;
        runState.hot = { r: v.r, c: v.c };
        runState.path = null;
      } else if (v.type === "trace") {
        runState.hot = null;
        runState.path = v.path;
      } else if (v.type === "done") {
        runState.hot = null;
        runState.done = true;
        let html = '<span class="label">' + v.answerLabel + ': </span>'
                 + '<span class="value">' + v.value + '</span>';
        if (v.extra) html += '  ·  <span style="color:var(--muted)">' + v.extra + '</span>';
        answerEl.innerHTML = html;
      }
      renderTable(runState);
    }, interval);
  }

  document.getElementById("dp-run").addEventListener("click", start);
  document.getElementById("dp-reset").addEventListener("click", reset);
  document.getElementById("dp-speed").addEventListener("input", (ev) => {
    document.getElementById("dp-speed-value").textContent = ev.target.value + "×";
  });

  // Allow Enter on inputs to run
  Object.values(inputs).forEach((el) => {
    if (el) el.addEventListener("keydown", (ev) => { if (ev.key === "Enter") start(); });
  });

  // Preset buttons
  document.querySelectorAll(".dp-presets button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.dataset.problem;
      select.value = p;
      setProblem();
      if (p === "lcs" || p === "edit") {
        inputs.A.value = btn.dataset.a;
        inputs.B.value = btn.dataset.b;
      } else if (p === "knapsack") {
        inputs.weights.value = btn.dataset.weights;
        inputs.values.value  = btn.dataset.values;
        inputs.W.value       = btn.dataset.capacity;
      }
      start();
    });
  });

  window.addEventListener("resize", () => {
    if (runState) renderTable(runState);
  });

  /* ============================================================ launch */
  setProblem();
  reset();
  // Auto-run with default LCS demo so visitor sees something
  requestAnimationFrame(() => {
    inputs.A.value = "ABCBDAB";
    inputs.B.value = "BDCABA";
    start();
  });
})();
