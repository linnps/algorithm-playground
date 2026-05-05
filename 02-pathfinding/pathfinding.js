/* ============================================================================
 * 02-pathfinding — A* / Dijkstra / BFS / DFS on a shared editable grid.
 *
 * Design:
 *   - One canonical grid stores walls + start + goal (the "world").
 *   - Four panel-Grid instances render the world plus a per-algorithm
 *     visited / frontier / path overlay.
 *   - Mouse events on any panel mutate the world; all four panels redraw.
 *   - Each algorithm is an ES6 generator yielding state snapshots
 *     {visited, frontier, expanded, found, path}.
 * ========================================================================== */

(function () {
  "use strict";

  // ------------------------------------------------------------- palette
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_VISITED  = "#9EB7D6";  // light blue
  const C_FRONTIER = "#D88080";  // light red
  const C_PATH     = css("--accent", "#C04040");

  // -------------------------------------------------------------- world
  const COLS = 28, ROWS = 18;

  // canonical world state — also serves as the "draft" Grid.
  // We don't render it directly; per-panel grids sync from it.
  const world = new Grid(document.createElement("canvas"), { cols: COLS, rows: ROWS });
  world.setStart(Math.floor(ROWS / 2), 2);
  world.setGoal(Math.floor(ROWS / 2), COLS - 3);

  // sprinkle some initial walls so users don't open an empty grid
  function seedDemoWalls() {
    const r1 = Math.floor(ROWS * 0.25);
    const r2 = Math.floor(ROWS * 0.75);
    for (let c = Math.floor(COLS * 0.30); c < Math.floor(COLS * 0.55); c++) {
      world.setWall(r1, c, true);
    }
    for (let c = Math.floor(COLS * 0.45); c < Math.floor(COLS * 0.70); c++) {
      world.setWall(r2, c, true);
    }
    for (let r = Math.floor(ROWS * 0.40); r < Math.floor(ROWS * 0.85); r++) {
      world.setWall(r, Math.floor(COLS * 0.65), true);
    }
  }
  seedDemoWalls();

  // ------------------------------------------------------- 4 algorithms
  const NEIGHBORS_4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function* bfs(W) {
    const startKey = W.keyOf(W.start.r, W.start.c);
    const visited = new Set([startKey]);
    const came = new Map();
    const queue = [{ ...W.start }];
    while (queue.length) {
      const cur = queue.shift();
      yield { type: "expand", cell: cur, frontier: queue.slice() };

      if (cur.r === W.goal.r && cur.c === W.goal.c) {
        yield { type: "done", path: reconstruct(came, cur) };
        return;
      }
      for (const [dr, dc] of NEIGHBORS_4) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!W.inBounds(nr, nc) || W.isWall(nr, nc)) continue;
        const k = W.keyOf(nr, nc);
        if (visited.has(k)) continue;
        visited.add(k);
        came.set(k, cur);
        queue.push({ r: nr, c: nc });
      }
    }
    yield { type: "done", path: null };
  }

  function* dfs(W) {
    const visited = new Set([W.keyOf(W.start.r, W.start.c)]);
    const came = new Map();
    const stack = [{ ...W.start }];
    while (stack.length) {
      const cur = stack.pop();
      yield { type: "expand", cell: cur, frontier: stack.slice() };

      if (cur.r === W.goal.r && cur.c === W.goal.c) {
        yield { type: "done", path: reconstruct(came, cur) };
        return;
      }
      // reverse so visual order looks like up/down/left/right
      for (let i = NEIGHBORS_4.length - 1; i >= 0; i--) {
        const [dr, dc] = NEIGHBORS_4[i];
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!W.inBounds(nr, nc) || W.isWall(nr, nc)) continue;
        const k = W.keyOf(nr, nc);
        if (visited.has(k)) continue;
        visited.add(k);
        came.set(k, cur);
        stack.push({ r: nr, c: nc });
      }
    }
    yield { type: "done", path: null };
  }

  // simple priority queue — array + linear extract-min.  Fine for grid sizes.
  function makePQ() {
    const arr = [];
    return {
      push(item) { arr.push(item); },
      pop() {
        if (!arr.length) return null;
        let best = 0;
        for (let i = 1; i < arr.length; i++) {
          if (arr[i].f < arr[best].f) best = i;
        }
        const it = arr[best];
        arr[best] = arr[arr.length - 1];
        arr.pop();
        return it;
      },
      get length() { return arr.length; },
      slice() { return arr.slice(); },
    };
  }

  function* dijkstra(W) {
    const startKey = W.keyOf(W.start.r, W.start.c);
    const cost = new Map([[startKey, 0]]);
    const came = new Map();
    const pq = makePQ();
    pq.push({ r: W.start.r, c: W.start.c, f: 0 });

    while (pq.length) {
      const cur = pq.pop();
      yield { type: "expand", cell: cur, frontier: pq.slice() };

      if (cur.r === W.goal.r && cur.c === W.goal.c) {
        yield { type: "done", path: reconstruct(came, cur) };
        return;
      }

      for (const [dr, dc] of NEIGHBORS_4) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!W.inBounds(nr, nc) || W.isWall(nr, nc)) continue;
        const k = W.keyOf(nr, nc);
        const nc_cost = cur.f + 1;     // unit edge weight
        if (cost.has(k) && cost.get(k) <= nc_cost) continue;
        cost.set(k, nc_cost);
        came.set(k, { r: cur.r, c: cur.c });
        pq.push({ r: nr, c: nc, f: nc_cost });
      }
    }
    yield { type: "done", path: null };
  }

  function manhattan(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

  function* astar(W) {
    const startKey = W.keyOf(W.start.r, W.start.c);
    const g = new Map([[startKey, 0]]);
    const came = new Map();
    const pq = makePQ();

    // tie-breaking: prefer paths that lie close to the straight start→goal line
    const dx0 = W.goal.c - W.start.c;
    const dy0 = W.goal.r - W.start.r;
    function tieBreak(r, c) {
      const dx = W.goal.c - c;
      const dy = W.goal.r - r;
      return Math.abs(dx * dy0 - dx0 * dy) * 0.001;
    }

    pq.push({ r: W.start.r, c: W.start.c, f: manhattan(W.start, W.goal) + tieBreak(W.start.r, W.start.c) });

    while (pq.length) {
      const cur = pq.pop();
      yield { type: "expand", cell: cur, frontier: pq.slice() };

      if (cur.r === W.goal.r && cur.c === W.goal.c) {
        yield { type: "done", path: reconstruct(came, cur) };
        return;
      }

      for (const [dr, dc] of NEIGHBORS_4) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!W.inBounds(nr, nc) || W.isWall(nr, nc)) continue;
        const k = W.keyOf(nr, nc);
        const ng = (g.get(W.keyOf(cur.r, cur.c)) || 0) + 1;
        if (g.has(k) && g.get(k) <= ng) continue;
        g.set(k, ng);
        came.set(k, { r: cur.r, c: cur.c });
        const f = ng + manhattan({ r: nr, c: nc }, W.goal) + tieBreak(nr, nc);
        pq.push({ r: nr, c: nc, f });
      }
    }
    yield { type: "done", path: null };
  }

  function reconstruct(came, end) {
    const path = [{ r: end.r, c: end.c }];
    let k = (came.size === 0) ? null : (end.r + "," + end.c);
    let cur = came.get(k);
    while (cur) {
      path.push({ r: cur.r, c: cur.c });
      cur = came.get(cur.r + "," + cur.c);
    }
    return path.reverse();
  }

  /* ------------------------------------------------------- algorithm catalog */
  const ALGOS = [
    { key: "astar",    name: "A*",        complexity: "O(b^d) · admissible heuristic",    gen: astar,    enabled: true },
    { key: "dijkstra", name: "Dijkstra",  complexity: "O((V+E) log V)",                   gen: dijkstra, enabled: true },
    { key: "bfs",      name: "BFS",       complexity: "O(V+E) · shortest on unweighted",  gen: bfs,      enabled: true },
    { key: "dfs",      name: "DFS",       complexity: "O(V+E) · NOT shortest",            gen: dfs,      enabled: true },
  ];

  /* ------------------------------------------------------------- DOM build */
  const board  = document.getElementById("pf-board");
  const checks = document.getElementById("algo-checks");

  ALGOS.forEach((a) => {
    const panel = document.createElement("div");
    panel.className = "pf-panel";
    panel.dataset.key = a.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + a.name + '</span>' +
        '<span class="complexity">' + a.complexity + '</span>' +
      '</div>' +
      '<div class="stats">' +
        '<span class="label">expanded</span><span class="exp">0</span>' +
        '<span class="sep">·</span>' +
        '<span class="label">path</span><span class="pathlen">—</span>' +
      '</div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    a.panel    = panel;
    a.canvas   = panel.querySelector("canvas");
    a.expEl    = panel.querySelector(".exp");
    a.pathEl   = panel.querySelector(".pathlen");

    a.grid = new Grid(a.canvas, { cols: COLS, rows: ROWS });
    Grid.syncStateFrom(a.grid, world);
    requestAnimationFrame(() => { a.grid.fitCanvas(); a.grid.draw(); });

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

  /* ------------------------------------------------- world ↔ panel sync */
  function syncAllPanels() {
    for (const a of ALGOS) {
      Grid.syncStateFrom(a.grid, world);
    }
    redrawAll();
  }
  function redrawAll() {
    for (const a of ALGOS) a.grid.draw();
  }

  /* ----------------------------------------------- mouse paint handlers */
  // Paint mode determined at mousedown:
  //   - on START cell  → drag start
  //   - on GOAL cell   → drag goal
  //   - on WALL cell   → erase
  //   - on EMPTY cell  → paint wall
  let dragMode = null;       // 'wall-paint' | 'wall-erase' | 'start' | 'goal'
  let dragging = false;
  let dragSourceAlgo = null;

  function startDrag(algo, ev) {
    const cell = algo.grid.cellAt(ev.clientX, ev.clientY);
    if (!cell) return;

    // What's at this cell?
    if (world.isStart(cell.r, cell.c)) dragMode = "start";
    else if (world.isGoal(cell.r, cell.c)) dragMode = "goal";
    else if (ev.button === 2 || world.isWall(cell.r, cell.c)) dragMode = "wall-erase";
    else dragMode = "wall-paint";

    dragging = true;
    dragSourceAlgo = algo;
    applyDrag(cell);
    ev.preventDefault();
  }

  function applyDrag(cell) {
    if (!cell) return;
    if (dragMode === "start") {
      if (world.isGoal(cell.r, cell.c)) return;     // can't overlap goal
      world.setStart(cell.r, cell.c);
    } else if (dragMode === "goal") {
      if (world.isStart(cell.r, cell.c)) return;
      world.setGoal(cell.r, cell.c);
    } else if (dragMode === "wall-paint") {
      if (world.isStart(cell.r, cell.c) || world.isGoal(cell.r, cell.c)) return;
      world.setWall(cell.r, cell.c, true);
    } else if (dragMode === "wall-erase") {
      world.setWall(cell.r, cell.c, false);
    }
    syncAllPanels();
  }

  function moveDrag(ev) {
    if (!dragging || !dragSourceAlgo) return;
    const cell = dragSourceAlgo.grid.cellAt(ev.clientX, ev.clientY);
    applyDrag(cell);
    // any wall change interrupts the run; auto-restart
    scheduleRun();
  }

  function endDrag() {
    if (dragging && (dragMode === "start" || dragMode === "goal")) {
      scheduleRun();
    }
    dragging = false;
    dragMode = null;
    dragSourceAlgo = null;
  }

  ALGOS.forEach((a) => {
    a.canvas.addEventListener("mousedown", (ev) => { startDrag(a, ev); scheduleRun(); });
    a.canvas.addEventListener("mousemove", moveDrag);
    a.canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  });
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("mouseleave", endDrag);

  /* --------------------------------------------------------------- runner */
  let runners = [];
  let paused = false;
  let speed = 6;
  let rafHandle = null;

  function fadeColor(hex, alpha) {
    // not actually used per-cell because we set overlay alpha; kept for ref
    return hex;
  }

  function reset() {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    runners = ALGOS.map((a) => {
      a.grid.clearOverlays();
      Grid.syncStateFrom(a.grid, world);
      return {
        algo: a,
        it: a.gen(world),
        expanded: 0,
        frontier: [],
        done: false,
        found: null,
        path: null,
      };
    });
    runners.forEach((r) => {
      r.algo.expEl.textContent = "0";
      r.algo.expEl.className = "exp";
      r.algo.pathEl.textContent = "—";
      r.algo.pathEl.className = "pathlen";
      r.algo.grid.draw();
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
        if (out.done) { r.done = true; break; }
        const v = out.value;
        if (v.type === "expand") {
          r.expanded++;
          // mark expanded cell as visited (light blue)
          if (!r.algo.grid.isStart(v.cell.r, v.cell.c) &&
              !r.algo.grid.isGoal(v.cell.r,  v.cell.c)) {
            r.algo.grid.setOverlay(v.cell.r, v.cell.c, C_VISITED, 0.85);
          }
          r.frontier = v.frontier || [];
        } else if (v.type === "done") {
          r.done = true;
          r.found = !!v.path;
          r.path  = v.path;
          if (v.path) {
            // light up the path in red, last
            for (const p of v.path) {
              if (!r.algo.grid.isStart(p.r, p.c) && !r.algo.grid.isGoal(p.r, p.c)) {
                r.algo.grid.setOverlay(p.r, p.c, C_PATH, 0.95);
              }
            }
          }
          break;
        }
      }

      // overlay current frontier (only while running, not after done)
      if (!r.done) {
        // remove stale frontier overlays by NOT re-applying (visited overlays
        // remain; frontier is transient, refreshed each frame)
        for (const f of r.frontier) {
          if (!r.algo.grid.isStart(f.r, f.c) && !r.algo.grid.isGoal(f.r, f.c)) {
            r.algo.grid.setOverlay(f.r, f.c, C_FRONTIER, 0.7);
          }
        }
      }

      r.algo.expEl.textContent = r.expanded.toLocaleString();
      if (r.done) {
        if (r.found && r.path) {
          r.algo.pathEl.textContent = r.path.length;
          r.algo.pathEl.className = "pathlen ok";
        } else {
          r.algo.pathEl.textContent = "no path";
          r.algo.pathEl.className = "pathlen fail";
        }
      }
      r.algo.grid.draw();

      if (!r.done) allDone = false;
    }

    if (!allDone) {
      rafHandle = requestAnimationFrame(tick);
    } else {
      rafHandle = null;
    }
  }

  // Debounce restart calls so dragging doesn't trigger 60 restarts/sec
  let restartTimer = null;
  function scheduleRun() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      reset();
    }, 80);
  }

  /* --------------------------------------------------------------- wiring */
  const speedEl = document.getElementById("speed");
  const speedV  = document.getElementById("speed-value");
  const pauseBtn= document.getElementById("pause");
  const resetBtn= document.getElementById("reset");
  const clearBtn= document.getElementById("clear-walls");
  const randBtn = document.getElementById("random-walls");

  speedEl.addEventListener("input", () => {
    speed = +speedEl.value;
    speedV.textContent = speed + "×";
  });
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    if (!paused && !rafHandle) rafHandle = requestAnimationFrame(tick);
  });
  resetBtn.addEventListener("click", () => { scheduleRun(); });
  clearBtn.addEventListener("click", () => { world.clearWalls(); syncAllPanels(); scheduleRun(); });
  randBtn.addEventListener("click", () => {
    world.clearWalls();
    const n = Math.floor(COLS * ROWS * 0.22);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 5) {
      tries++;
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (world.isStart(r, c) || world.isGoal(r, c)) continue;
      world.setWall(r, c, true);
      placed++;
    }
    syncAllPanels();
    scheduleRun();
  });

  window.addEventListener("resize", () => {
    ALGOS.forEach((a) => { a.grid.fitCanvas(); a.grid.draw(); });
  });

  /* --------------------------------------------------------------- launch */
  // wait one tick so layout settles
  requestAnimationFrame(() => {
    ALGOS.forEach((a) => { a.grid.fitCanvas(); a.grid.draw(); });
    reset();
  });
})();
