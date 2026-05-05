/* ============================================================================
 * 05-trees — BST · AVL · Red-Black, side by side.
 *
 * Three trees receive the same insertion sequence one key at a time.
 * After each insert the panels are re-rendered. The freshly-inserted key
 * gets a brief red highlight ring so the eye can track where it landed
 * before any rebalancing is applied.
 *
 * Stats above each panel show:
 *   - height (depth of deepest leaf — the discriminating metric)
 *   - node count
 *   - "PATHOLOGICAL" warning when BST height ≥ 0.7 × node count
 *     (i.e., the tree is becoming a linked list)
 *
 * Trees are rendered with in-order x layout (Knuth's simplest scheme):
 *   x = position in in-order traversal × spacing
 *   y = depth × spacing
 * Subtree overlap can't happen because every node has its own x slot.
 * ========================================================================== */

(function () {
  "use strict";

  /* ----------------------------------------------------------------- palette */
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_BG       = css("--bg-soft", "#F7F7F5");
  const C_BG_NODE  = css("--bg", "#FFFFFF");
  const C_TEXT     = css("--text", "#333333");
  const C_TITLE    = css("--title", "#3B6EA8");
  const C_ACCENT   = css("--accent", "#C04040");
  const C_MUTED    = css("--muted", "#7A7A7A");
  const C_LIGHT    = css("--light", "#CCCCCC");

  /* ============================================================== BST */
  function bstInsert(root, key) {
    if (!root) return { key, left: null, right: null };
    if (key < root.key) root.left  = bstInsert(root.left, key);
    else if (key > root.key) root.right = bstInsert(root.right, key);
    return root;
  }

  /* ============================================================== AVL */
  function avlH(n)        { return n ? n.height : 0; }
  function avlBal(n)      { return n ? avlH(n.left) - avlH(n.right) : 0; }
  function avlUpd(n)      { n.height = 1 + Math.max(avlH(n.left), avlH(n.right)); }
  function rotateR(y) {
    const x = y.left, t2 = x.right;
    x.right = y; y.left = t2;
    avlUpd(y); avlUpd(x);
    return x;
  }
  function rotateL(x) {
    const y = x.right, t2 = y.left;
    y.left = x; x.right = t2;
    avlUpd(x); avlUpd(y);
    return y;
  }
  function avlInsert(root, key) {
    if (!root) return { key, left: null, right: null, height: 1 };
    if (key < root.key) root.left  = avlInsert(root.left, key);
    else if (key > root.key) root.right = avlInsert(root.right, key);
    else return root;
    avlUpd(root);
    const b = avlBal(root);
    if (b >  1 && key < root.left.key)  return rotateR(root);
    if (b < -1 && key > root.right.key) return rotateL(root);
    if (b >  1 && key > root.left.key)  { root.left  = rotateL(root.left);  return rotateR(root); }
    if (b < -1 && key < root.right.key) { root.right = rotateR(root.right); return rotateL(root); }
    return root;
  }

  /* ====================================================== Red-Black */
  // Standard CLRS RB-INSERT with parent pointers.
  const RED = "R", BLACK = "B";
  class RBTree {
    constructor() { this.root = null; }

    insert(key) {
      const z = { key, color: RED, left: null, right: null, parent: null };
      let p = null, cur = this.root;
      while (cur) {
        p = cur;
        if (key < cur.key) cur = cur.left;
        else if (key > cur.key) cur = cur.right;
        else return;                        // ignore duplicates
      }
      z.parent = p;
      if (!p) this.root = z;
      else if (key < p.key) p.left = z;
      else p.right = z;
      this._fixInsert(z);
    }

    _fixInsert(z) {
      while (z.parent && z.parent.color === RED) {
        const gp = z.parent.parent;
        if (!gp) break;
        if (z.parent === gp.left) {
          const y = gp.right;
          if (y && y.color === RED) {
            z.parent.color = BLACK; y.color = BLACK; gp.color = RED;
            z = gp;
          } else {
            if (z === z.parent.right) { z = z.parent; this._rotL(z); }
            z.parent.color = BLACK; gp.color = RED; this._rotR(gp);
          }
        } else {
          const y = gp.left;
          if (y && y.color === RED) {
            z.parent.color = BLACK; y.color = BLACK; gp.color = RED;
            z = gp;
          } else {
            if (z === z.parent.left) { z = z.parent; this._rotR(z); }
            z.parent.color = BLACK; gp.color = RED; this._rotL(gp);
          }
        }
      }
      this.root.color = BLACK;
    }
    _rotL(x) {
      const y = x.right;
      x.right = y.left;
      if (y.left) y.left.parent = x;
      y.parent = x.parent;
      if (!x.parent) this.root = y;
      else if (x === x.parent.left) x.parent.left = y;
      else x.parent.right = y;
      y.left = x;
      x.parent = y;
    }
    _rotR(x) {
      const y = x.left;
      x.left = y.right;
      if (y.right) y.right.parent = x;
      y.parent = x.parent;
      if (!x.parent) this.root = y;
      else if (x === x.parent.right) x.parent.right = y;
      else x.parent.left = y;
      y.right = x;
      x.parent = y;
    }
  }

  /* ----------------------------------------------------------- common ops */
  function treeHeight(n) {
    if (!n) return 0;
    return 1 + Math.max(treeHeight(n.left), treeHeight(n.right));
  }
  function treeNodes(n) {
    if (!n) return 0;
    return 1 + treeNodes(n.left) + treeNodes(n.right);
  }

  /* ----------------------------------------------- in-order layout */
  function layout(root) {
    let xc = 0;
    const xs = new Map();
    const ys = new Map();
    function visit(n, d) {
      if (!n) return;
      visit(n.left, d + 1);
      xs.set(n, xc++);
      ys.set(n, d);
      visit(n.right, d + 1);
    }
    visit(root, 0);
    let maxD = 0;
    for (const d of ys.values()) if (d > maxD) maxD = d;
    return { xs, ys, totalCols: xc, maxDepth: maxD };
  }

  /* ---------------------------------------------------- rendering */
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

  function render(canvas, root, opts) {
    opts = opts || {};
    const ctx = fitCanvas(canvas);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, w, h);

    if (!root) {
      ctx.fillStyle = C_MUTED;
      ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("(empty)", w / 2, h / 2);
      return;
    }

    const { xs, ys, totalCols, maxDepth } = layout(root);
    const pad = 28;
    const xSpacing = totalCols > 1
      ? Math.min(36, (w - 2 * pad) / (totalCols - 1))
      : 0;
    const ySpacing = maxDepth > 0
      ? Math.min(48, (h - 2 * pad) / maxDepth)
      : 0;
    const xOrigin = (w - (totalCols - 1) * xSpacing) / 2;
    const yOrigin = pad;

    function pos(n) {
      return {
        x: xOrigin + xs.get(n) * xSpacing,
        y: yOrigin + ys.get(n) * ySpacing,
      };
    }

    // edges first
    ctx.strokeStyle = C_MUTED;
    ctx.lineWidth = 1.2;
    function drawEdges(n) {
      if (!n) return;
      const p = pos(n);
      if (n.left) {
        const cp = pos(n.left);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        drawEdges(n.left);
      }
      if (n.right) {
        const cp = pos(n.right);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(cp.x, cp.y); ctx.stroke();
        drawEdges(n.right);
      }
    }
    drawEdges(root);

    // nodes
    const r = 13;
    function drawNodes(n) {
      if (!n) return;
      const p = pos(n);
      let fill, fg;
      if (n.color === RED)        { fill = C_ACCENT; fg = "#FFFFFF"; }
      else if (n.color === BLACK) { fill = C_TEXT;   fg = "#FFFFFF"; }
      else                        { fill = C_TITLE;  fg = "#FFFFFF"; }

      // highlight ring on the freshly-inserted node
      if (opts.highlight !== undefined && n.key === opts.highlight) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(192, 64, 64, 0.20)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = C_ACCENT;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = "#1A1A1A";
      ctx.stroke();

      ctx.fillStyle = fg;
      ctx.font = "700 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n.key), p.x, p.y);

      if (opts.showHeight && n.height) {
        ctx.fillStyle = C_MUTED;
        ctx.font = "9px ui-monospace, Menlo, Monaco, monospace";
        ctx.fillText("h" + n.height, p.x, p.y + r + 9);
      }
      drawNodes(n.left);
      drawNodes(n.right);
    }
    drawNodes(root);
  }

  /* ----------------------------------------------------- DOM build */
  const TREES = [
    { key: "bst", name: "BST (no balancing)",            stat: null, root: null,            insert: (key) => { TREES[0].root = bstInsert(TREES[0].root, key); } },
    { key: "avl", name: "AVL · height-balanced",         stat: null, root: null,            insert: (key) => { TREES[1].root = avlInsert(TREES[1].root, key); }, showHeight: true },
    { key: "rb",  name: "Red-Black · loosely balanced",  stat: null, rb:  new RBTree(),     insert: (key) => { TREES[2].rb.insert(key); } },
  ];

  const board = document.getElementById("tree-board");
  TREES.forEach((t) => {
    const panel = document.createElement("div");
    panel.className = "tree-panel";
    panel.dataset.key = t.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + t.name + '</span>' +
      '</div>' +
      '<div class="stats">' +
        '<span class="label">height</span><span class="height-val">0</span>' +
        '<span class="sep">·</span>' +
        '<span class="label">nodes</span><span class="nodes-val">0</span>' +
        '<span class="sep">·</span>' +
        '<span class="status">empty</span>' +
      '</div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    t.canvas    = panel.querySelector("canvas");
    t.heightEl  = panel.querySelector(".height-val");
    t.nodesEl   = panel.querySelector(".nodes-val");
    t.statusEl  = panel.querySelector(".status");
  });

  function rootOf(t) { return t.key === "rb" ? t.rb.root : t.root; }

  function renderAll(highlight) {
    for (const t of TREES) {
      const root = rootOf(t);
      const h = treeHeight(root);
      const n = treeNodes(root);
      t.heightEl.textContent = h;
      t.nodesEl.textContent  = n;
      // BST pathological check
      if (t.key === "bst" && n >= 4 && h >= 0.7 * n) {
        t.statusEl.textContent = "PATHOLOGICAL · degraded to chain";
        t.statusEl.className   = "status pathol";
      } else if (n > 0) {
        t.statusEl.textContent = "balanced (height ≤ 2 log₂ n)";
        t.statusEl.className   = "status balanced";
      } else {
        t.statusEl.textContent = "empty";
        t.statusEl.className   = "status";
      }
      render(t.canvas, root, {
        highlight,
        showHeight: t.showHeight,
      });
    }
  }

  function clearAll() {
    TREES[0].root = null;
    TREES[1].root = null;
    TREES[2].rb   = new RBTree();
  }

  /* ----------------------------------------------- playback driver */
  let sequence = [];
  let stepIdx = 0;
  let timer = null;
  let paused = false;
  let delay = 600;

  function parseSeq(text) {
    return text.split(/[,\s]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
  }

  function start(seq) {
    cancelAnimationFrame(timer);
    if (timer) { clearTimeout(timer); timer = null; }
    sequence = seq.slice();
    stepIdx = 0;
    clearAll();
    renderAll();
    paused = false;
    document.getElementById("pause").textContent = "Pause";
    updateProgress();
    if (sequence.length) {
      step();          // do first step immediately
    }
  }

  function step() {
    if (paused) return;
    if (stepIdx >= sequence.length) {
      timer = null;
      updateProgress();
      return;
    }
    const k = sequence[stepIdx++];
    for (const t of TREES) t.insert(k);
    renderAll(k);
    updateProgress();
    timer = setTimeout(step, delay);
  }

  function updateProgress() {
    const el = document.getElementById("progress");
    if (!el) return;
    if (sequence.length === 0) el.textContent = "—";
    else el.textContent = stepIdx + " / " + sequence.length;
  }

  /* ----------------------------------------------------- wiring */
  const seqInput = document.getElementById("seq-input");
  const speedEl  = document.getElementById("speed");
  const speedV   = document.getElementById("speed-value");

  function readAndStart() {
    const seq = parseSeq(seqInput.value);
    start(seq);
  }

  document.getElementById("run").addEventListener("click", readAndStart);
  seqInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") readAndStart();
  });

  // Speed slider — maps 1..10 to delay 1500..150 ms
  speedEl.addEventListener("input", () => {
    const v = +speedEl.value;
    speedV.textContent = v + "×";
    delay = Math.max(80, Math.round(1500 / v));
  });

  document.getElementById("pause").addEventListener("click", () => {
    paused = !paused;
    document.getElementById("pause").textContent = paused ? "Resume" : "Pause";
    if (!paused && stepIdx < sequence.length) step();
  });

  // Preset buttons
  document.querySelectorAll(".preset-buttons button").forEach((btn) => {
    btn.addEventListener("click", () => {
      seqInput.value = btn.dataset.seq;
      readAndStart();
    });
  });

  document.getElementById("clear").addEventListener("click", () => {
    if (timer) { clearTimeout(timer); timer = null; }
    sequence = []; stepIdx = 0;
    clearAll();
    renderAll();
    updateProgress();
  });

  window.addEventListener("resize", () => renderAll());

  /* ----------------------------------------------------- launch */
  // Default: ascending sequence — pathological for plain BST.
  seqInput.value = "1, 2, 3, 4, 5, 6, 7, 8, 9, 10";
  delay = 600;
  requestAnimationFrame(() => readAndStart());
})();
