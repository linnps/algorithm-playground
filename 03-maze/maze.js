/* ============================================================================
 * 03-maze — DFS recursive backtracker · Prim's · Kruskal's · Wilson's
 *
 * Each algorithm carves a maze on a fresh "all walls" grid by removing wall
 * cells in some order.  Starting from an entirely closed grid, the algorithms
 * differ only in WHICH WALL TO CARVE NEXT — and that choice produces visibly
 * different maze styles.
 *
 * Grid mapping:
 *   - Logical maze of ROOMS_R × ROOMS_C rooms.
 *   - Each room R,C lives at grid coordinate (2R, 2C).
 *   - The wall between rooms (R1,C1) and (R2,C2) lives at (R1+R2, C1+C2).
 *   - All other cells (odd r AND odd c) are wall corners that stay walls.
 *
 * Each algorithm is an ES6 generator yielding {type, cell?, walk?}.
 * ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- shape */
  // 13 × 8 logical rooms ⇒ 25 × 15 grid cells (both odd, room (R,C) at 2R,2C).
  const ROOMS_C = 13;
  const ROOMS_R = 8;
  const GRID_C  = 2 * ROOMS_C - 1;        // 25
  const GRID_R  = 2 * ROOMS_R - 1;        // 15

  function roomToGrid(R, C) { return { r: 2 * R, c: 2 * C }; }
  function wallBetween(R1, C1, R2, C2) { return { r: R1 + R2, c: C1 + C2 }; }
  // (Note: R1+R2 corresponds to grid row (2*R1+2*R2)/2 — but since R2 = R1±1
  // adjacent rooms, R1+R2 is one of {2R1+1, 2R1-1}, the wall row.  Same for C.)

  /* ---------------------------------------------------------------- utils */
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function fillWalls(W) {
    W.walls.fill(1);
    W.clearOverlays();
  }
  function carveRoom(W, R, C)         { W.setWall(2 * R, 2 * C, false); }
  function carveWall(W, R1, C1, R2, C2) {
    const w = wallBetween(R1, C1, R2, C2);
    W.setWall(w.r, w.c, false);
    return w;
  }

  /* ----------------------------------------------------------- algorithms */

  // 1) Recursive-backtracker DFS — long winding corridors with few branches.
  function* dfsBacktracker(W) {
    fillWalls(W);
    const visited = new Set();
    const startR = Math.floor(Math.random() * ROOMS_R);
    const startC = Math.floor(Math.random() * ROOMS_C);
    visited.add(startR + "," + startC);
    carveRoom(W, startR, startC);
    yield { type: "carve", cell: roomToGrid(startR, startC) };

    const stack = [{ R: startR, C: startC }];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const candidates = shuffle(DIRS.slice());
      let advanced = false;
      for (const [dR, dC] of candidates) {
        const nR = cur.R + dR, nC = cur.C + dC;
        if (nR < 0 || nR >= ROOMS_R || nC < 0 || nC >= ROOMS_C) continue;
        if (visited.has(nR + "," + nC)) continue;
        visited.add(nR + "," + nC);
        carveWall(W, cur.R, cur.C, nR, nC);
        carveRoom(W, nR, nC);
        stack.push({ R: nR, C: nC });
        yield { type: "carve", cell: roomToGrid(nR, nC) };
        advanced = true;
        break;
      }
      if (!advanced) {
        stack.pop();
        yield { type: "backtrack", cell: roomToGrid(cur.R, cur.C) };
      }
    }
    yield { type: "done" };
  }

  // 2) Prim's — random frontier expansion.  Many short branches ("spiky").
  function* primsMaze(W) {
    fillWalls(W);
    const inMaze = new Set();
    const frontier = [];   // wall edges between an in-maze room and an out-of-maze room

    function addFrontier(R, C) {
      for (const [dR, dC] of DIRS) {
        const nR = R + dR, nC = C + dC;
        if (nR < 0 || nR >= ROOMS_R || nC < 0 || nC >= ROOMS_C) continue;
        if (inMaze.has(nR + "," + nC)) continue;
        frontier.push({ from: { R, C }, to: { R: nR, C: nC } });
      }
    }

    const startR = Math.floor(Math.random() * ROOMS_R);
    const startC = Math.floor(Math.random() * ROOMS_C);
    inMaze.add(startR + "," + startC);
    carveRoom(W, startR, startC);
    addFrontier(startR, startC);
    yield { type: "carve", cell: roomToGrid(startR, startC) };

    while (frontier.length) {
      const i = Math.floor(Math.random() * frontier.length);
      const e = frontier[i];
      frontier[i] = frontier[frontier.length - 1];
      frontier.pop();

      const k = e.to.R + "," + e.to.C;
      if (inMaze.has(k)) continue;
      inMaze.add(k);
      carveWall(W, e.from.R, e.from.C, e.to.R, e.to.C);
      carveRoom(W, e.to.R, e.to.C);
      addFrontier(e.to.R, e.to.C);
      yield { type: "carve", cell: roomToGrid(e.to.R, e.to.C) };
    }
    yield { type: "done" };
  }

  // 3) Kruskal's — random edges + union-find.  Uniform-looking, no obvious bias.
  function* kruskalsMaze(W) {
    fillWalls(W);
    // pre-carve every room (rooms always passages; only walls vary)
    for (let R = 0; R < ROOMS_R; R++)
      for (let C = 0; C < ROOMS_C; C++)
        carveRoom(W, R, C);
    yield { type: "carve", cell: { r: 0, c: 0 } };

    // union-find
    const parent = new Map();
    function find(x) {
      if (!parent.has(x)) parent.set(x, x);
      let p = parent.get(x);
      while (p !== x) {
        const pp = parent.get(p);
        parent.set(x, pp);
        x = p; p = pp;
      }
      return x;
    }
    function union(a, b) {
      const ra = find(a), rb = find(b);
      if (ra === rb) return false;
      parent.set(ra, rb);
      return true;
    }

    // every wall between adjacent rooms, shuffled
    const walls = [];
    for (let R = 0; R < ROOMS_R; R++) {
      for (let C = 0; C < ROOMS_C; C++) {
        if (R + 1 < ROOMS_R) walls.push({ a: { R, C }, b: { R: R + 1, C: C } });
        if (C + 1 < ROOMS_C) walls.push({ a: { R, C }, b: { R: R, C: C + 1 } });
      }
    }
    shuffle(walls);

    for (const w of walls) {
      const ka = w.a.R + "," + w.a.C;
      const kb = w.b.R + "," + w.b.C;
      if (find(ka) === find(kb)) {
        yield { type: "skip" };
        continue;
      }
      union(ka, kb);
      carveWall(W, w.a.R, w.a.C, w.b.R, w.b.C);
      yield { type: "carve", cell: roomToGrid(w.b.R, w.b.C) };
    }
    yield { type: "done" };
  }

  // 4) Wilson's — loop-erased random walks.  Provably uniform spanning tree.
  //    Slowest of the four; the random walks themselves are the most visually
  //    interesting part of the algorithm.
  function* wilsonsMaze(W) {
    fillWalls(W);
    const inMaze = new Set();

    // Pick one initial room as "in maze"
    const initR = Math.floor(Math.random() * ROOMS_R);
    const initC = Math.floor(Math.random() * ROOMS_C);
    inMaze.add(initR + "," + initC);
    carveRoom(W, initR, initC);
    yield { type: "carve", cell: roomToGrid(initR, initC) };

    const order = [];
    for (let R = 0; R < ROOMS_R; R++)
      for (let C = 0; C < ROOMS_C; C++)
        order.push({ R, C });
    shuffle(order);

    for (const start of order) {
      if (inMaze.has(start.R + "," + start.C)) continue;

      // Loop-erased random walk from `start` until we hit `inMaze`.
      const walk = [{ R: start.R, C: start.C }];
      const idx = new Map();           // "R,C" → index in walk
      idx.set(start.R + "," + start.C, 0);

      let cur = start;
      while (!inMaze.has(cur.R + "," + cur.C)) {
        const [dR, dC] = DIRS[Math.floor(Math.random() * 4)];
        const nR = cur.R + dR, nC = cur.C + dC;
        if (nR < 0 || nR >= ROOMS_R || nC < 0 || nC >= ROOMS_C) continue;
        const key = nR + "," + nC;

        if (idx.has(key)) {
          // erase loop: trim walk back to first visit of `key`
          const i = idx.get(key);
          for (let j = walk.length - 1; j > i; j--) {
            idx.delete(walk[j].R + "," + walk[j].C);
          }
          walk.length = i + 1;
        } else {
          walk.push({ R: nR, C: nC });
          idx.set(key, walk.length - 1);
        }
        cur = { R: nR, C: nC };

        // Visualise the current walk path as transient overlay.
        const overlay = walk.map((p) => roomToGrid(p.R, p.C));
        yield { type: "walk", cell: roomToGrid(nR, nC), walk: overlay };
      }

      // Walk now ends at a cell already in the maze — carve all walks.
      for (let i = 0; i < walk.length - 1; i++) {
        carveRoom(W, walk[i].R, walk[i].C);
        carveWall(W, walk[i].R, walk[i].C, walk[i + 1].R, walk[i + 1].C);
        inMaze.add(walk[i].R + "," + walk[i].C);
        yield { type: "carve", cell: roomToGrid(walk[i].R, walk[i].C) };
      }
    }
    yield { type: "done" };
  }

  /* ---------------------------------------------------------- catalog */
  const ALGOS = [
    { key: "dfs",      name: "DFS recursive backtracker", character: "long winding corridors", gen: dfsBacktracker, enabled: true },
    { key: "prims",    name: "Prim's",                    character: "spiky · many short branches", gen: primsMaze,    enabled: true },
    { key: "kruskals", name: "Kruskal's",                 character: "uniform-looking · few obvious patterns", gen: kruskalsMaze, enabled: true },
    { key: "wilsons",  name: "Wilson's",                  character: "uniform spanning tree (truly unbiased) · slow", gen: wilsonsMaze, enabled: true },
  ];

  /* --------------------------------------------------------- DOM build */
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_ACTIVE = css("--accent", "#C04040");
  const C_WALK   = "#9EB7D6";   // light blue for transient walk overlay

  const board  = document.getElementById("maze-board");
  const checks = document.getElementById("algo-checks");

  ALGOS.forEach((a) => {
    const panel = document.createElement("div");
    panel.className = "maze-panel";
    panel.dataset.key = a.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + a.name + '</span>' +
      '</div>' +
      '<div class="character">' + a.character + '</div>' +
      '<div class="stats">' +
        '<span class="label">carved</span><span class="cnt">0</span>' +
        '<span class="sep">·</span>' +
        '<span class="status">running…</span>' +
      '</div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    a.panel  = panel;
    a.canvas = panel.querySelector("canvas");
    a.cntEl  = panel.querySelector(".cnt");
    a.statEl = panel.querySelector(".status");

    a.grid = new Grid(a.canvas, { cols: GRID_C, rows: GRID_R });
    a.grid.walls.fill(1);                 // all walls initially
    requestAnimationFrame(() => { a.grid.fitCanvas(); a.grid.draw(); });

    const id = "chk-" + a.key;
    const lab = document.createElement("label");
    lab.innerHTML = '<input type="checkbox" id="' + id + '" checked> ' + a.name;
    checks.appendChild(lab);
    lab.querySelector("input").addEventListener("change", (ev) => {
      a.enabled = ev.target.checked;
      a.panel.classList.toggle("dim", !a.enabled);
    });
  });

  /* ----------------------------------------------------------- runner */
  let runners = [];
  let paused = false;
  let speed = 8;
  let rafHandle = null;

  function reset() {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    runners = ALGOS.map((a) => {
      a.grid.walls.fill(1);
      a.grid.clearOverlays();
      return {
        algo: a,
        it: a.gen(a.grid),
        carved: 0,
        done: false,
        prevWalk: null,
      };
    });
    runners.forEach((r) => {
      r.algo.cntEl.textContent = "0";
      r.algo.statEl.textContent = "running…";
      r.algo.statEl.className = "status";
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

        // For Wilson's: clear previous walk overlay then redraw new one
        if (r.prevWalk) {
          for (const cell of r.prevWalk) {
            r.algo.grid.overlays.delete(r.algo.grid.keyOf(cell.r, cell.c));
          }
          r.prevWalk = null;
        }

        if (v.type === "walk") {
          // transient: highlight the random walk path in light blue
          for (const cell of v.walk) {
            r.algo.grid.setOverlay(cell.r, cell.c, C_WALK, 0.7);
          }
          r.prevWalk = v.walk;
          // also a brighter dot at current head
          r.algo.grid.setOverlay(v.cell.r, v.cell.c, C_ACTIVE, 0.85);
          if (r.prevWalk) r.prevWalk.push(v.cell);
        } else if (v.type === "carve") {
          r.carved++;
        } else if (v.type === "done") {
          r.done = true;
          break;
        }
      }

      r.algo.cntEl.textContent = r.carved.toLocaleString();
      if (r.done) {
        r.algo.statEl.textContent = "done ✓";
        r.algo.statEl.className = "status done";
        // wipe transient overlays at end
        if (r.prevWalk) {
          for (const cell of r.prevWalk) {
            r.algo.grid.overlays.delete(r.algo.grid.keyOf(cell.r, cell.c));
          }
        }
      }
      r.algo.grid.draw();
      if (!r.done) allDone = false;
    }

    if (!allDone) rafHandle = requestAnimationFrame(tick);
    else rafHandle = null;
  }

  /* ----------------------------------------------------------- wiring */
  document.getElementById("speed").addEventListener("input", (ev) => {
    speed = +ev.target.value;
    document.getElementById("speed-value").textContent = speed + "×";
  });
  document.getElementById("pause").addEventListener("click", () => {
    paused = !paused;
    document.getElementById("pause").textContent = paused ? "Resume" : "Pause";
    if (!paused && !rafHandle) rafHandle = requestAnimationFrame(tick);
  });
  document.getElementById("reset").addEventListener("click", reset);

  window.addEventListener("resize", () => {
    ALGOS.forEach((a) => { a.grid.fitCanvas(); a.grid.draw(); });
  });

  /* ----------------------------------------------------------- launch */
  requestAnimationFrame(() => {
    ALGOS.forEach((a) => { a.grid.fitCanvas(); a.grid.draw(); });
    reset();
  });
})();
