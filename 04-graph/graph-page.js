/* ============================================================================
 * 04-graph — BFS · DFS · topological sort · Tarjan SCC on a shared user-built graph.
 *
 * Single canonical "world" Graph stores nodes + edges; four panel-Graphs
 * mirror the structure for visualisation, each with its own per-algorithm
 * colour overlay.
 *
 * UX:
 *   - left-click empty space → add node
 *   - left-click node and drag to another node → add edge
 *   - left-click node, release at empty space → no-op (cancels)
 *   - right-click node → remove node (and incident edges)
 *
 * Algorithms (each as a generator yielding {type, node?, depth?, sccs?}):
 *   - BFS                  · colour by depth (gradient blue)
 *   - DFS                  · colour by finish order
 *   - Topological sort     · colour by sequence position (red on cycle)
 *   - Tarjan SCC           · colour by SCC group
 * ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- palette */
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const C_BLUE   = css("--title", "#3B6EA8");
  const C_RED    = css("--accent", "#C04040");
  const C_GRAY   = css("--muted", "#7A7A7A");
  const C_LIGHT  = "#9EB7D6";
  const C_LIGHTER= "#D8E0EC";

  // gradient blue for ordered colourings (BFS depth, DFS finish, topo position)
  const RAMP = ["#D8E0EC", "#9EB7D6", "#5A8FCC", "#3B6EA8", "#1F4670"];
  function rampColor(i, total) {
    if (total <= 1) return RAMP[Math.floor(RAMP.length / 2)];
    const t = i / (total - 1);
    const idx = Math.min(RAMP.length - 1, Math.floor(t * (RAMP.length - 0.001)));
    return RAMP[idx];
  }

  // distinct colours for SCCs (hand-picked, palette-friendly)
  const SCC_COLORS = [
    "#3B6EA8", "#C04040", "#7A7A7A", "#9EB7D6", "#D88080",
    "#5A8FCC", "#A8A8A8", "#7A4040", "#3D6E8C", "#9F4F8C",
  ];

  /* ---------------------------------------------------- canonical graph */
  // shared state for editing — never rendered directly
  const world = new Graph(document.createElement("canvas"));

  // pre-populate with a small DAG so the page isn't empty.
  // Layout: 2 rows
  function seed() {
    const W = 560, H = 240;
    const a = world.addNode(110, 80);
    const b = world.addNode(280, 80);
    const c = world.addNode(220, 170);
    const d = world.addNode(390, 170);
    const e = world.addNode(490, 80);
    world.addEdge(a, b);
    world.addEdge(a, c);
    world.addEdge(b, d);
    world.addEdge(c, d);
    world.addEdge(d, e);
  }
  seed();

  /* -------------------------------------------------------- algorithms */

  // BFS — colour by depth
  function* bfs(g) {
    const ids = g.nodeIds();
    const depth = new Map();
    let maxDepth = 0;
    for (const start of ids) {
      if (depth.has(start)) continue;
      depth.set(start, 0);
      const queue = [start];
      while (queue.length) {
        const v = queue.shift();
        yield { type: "visit", node: v, depth: depth.get(v) };
        maxDepth = Math.max(maxDepth, depth.get(v));
        for (const w of g.outNeighbors(v)) {
          if (!depth.has(w)) {
            depth.set(w, depth.get(v) + 1);
            queue.push(w);
          }
        }
      }
    }
    yield { type: "done", depth, maxDepth };
  }

  // DFS — colour by finish-order rank
  function* dfsAlg(g) {
    const visited = new Set();
    const finishOrder = [];

    function* visit(v, depth) {
      visited.add(v);
      yield { type: "discover", node: v, depth };
      for (const w of g.outNeighbors(v)) {
        if (!visited.has(w)) yield* visit(w, depth + 1);
      }
      finishOrder.push(v);
      yield { type: "finish", node: v, position: finishOrder.length };
    }
    for (const v of g.nodeIds()) {
      if (!visited.has(v)) yield* visit(v, 0);
    }
    yield { type: "done", finishOrder };
  }

  // Topological sort — DFS-based; detect cycle by tracking onStack
  function* topoSort(g) {
    const visited = new Set();
    const onStack = new Set();
    const order = [];
    let cycle = null;

    function* visit(v) {
      if (cycle) return;
      visited.add(v);
      onStack.add(v);
      yield { type: "discover", node: v };
      for (const w of g.outNeighbors(v)) {
        if (cycle) return;
        if (onStack.has(w)) {
          cycle = { at: w, from: v };
          yield { type: "cycle", at: w, from: v };
          return;
        }
        if (!visited.has(w)) {
          yield* visit(w);
          if (cycle) return;
        }
      }
      onStack.delete(v);
      order.push(v);
      yield { type: "finish", node: v, position: order.length };
    }
    for (const v of g.nodeIds()) {
      if (cycle) break;
      if (!visited.has(v)) yield* visit(v);
    }
    if (cycle) {
      yield { type: "done", order: null, cycle };
    } else {
      yield { type: "done", order: order.slice().reverse() };
    }
  }

  // Tarjan SCC — iterative would be cleaner but recursive is shorter and
  // graph sizes are small here.
  function* tarjan(g) {
    const idx = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    let counter = 0;

    function* strongconnect(v) {
      idx.set(v, counter);
      low.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);
      yield { type: "discover", node: v };

      for (const w of g.outNeighbors(v)) {
        if (!idx.has(w)) {
          yield* strongconnect(w);
          low.set(v, Math.min(low.get(v), low.get(w)));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v), idx.get(w)));
        }
      }

      if (low.get(v) === idx.get(v)) {
        const comp = [];
        let w;
        do {
          w = stack.pop();
          onStack.delete(w);
          comp.push(w);
        } while (w !== v);
        sccs.push(comp);
        yield { type: "scc", component: comp.slice(), index: sccs.length - 1 };
      }
    }
    for (const v of g.nodeIds()) {
      if (!idx.has(v)) yield* strongconnect(v);
    }
    yield { type: "done", sccs };
  }

  /* ---------------------------------------------------------- catalog */
  const ALGOS = [
    { key: "bfs",   name: "BFS — depth colouring",            complexity: "O(V + E)", gen: bfs,      enabled: true },
    { key: "dfs",   name: "DFS — finish-order colouring",     complexity: "O(V + E)", gen: dfsAlg,   enabled: true },
    { key: "topo",  name: "Topological sort",                 complexity: "O(V + E) · DAG only", gen: topoSort, enabled: true },
    { key: "tarjan",name: "Tarjan strongly-connected comps",  complexity: "O(V + E)", gen: tarjan,   enabled: true },
  ];

  /* ---------------------------------------------------- DOM build */
  const board  = document.getElementById("gp-board");
  const checks = document.getElementById("algo-checks");

  ALGOS.forEach((a) => {
    const panel = document.createElement("div");
    panel.className = "gp-panel";
    panel.dataset.key = a.key;
    panel.innerHTML =
      '<div class="head">' +
        '<span class="name">' + a.name + '</span>' +
        '<span class="complexity">' + a.complexity + '</span>' +
      '</div>' +
      '<div class="result"><span class="label">result:</span><span class="text">running…</span></div>' +
      '<canvas></canvas>';
    board.appendChild(panel);
    a.panel  = panel;
    a.canvas = panel.querySelector("canvas");
    a.resultEl = panel.querySelector(".text");

    a.graph = new Graph(a.canvas);
    Graph.syncStructureFrom(a.graph, world);
    requestAnimationFrame(() => { a.graph.fitCanvas(); a.graph.draw(); });

    const id = "chk-" + a.key;
    const lab = document.createElement("label");
    lab.innerHTML = '<input type="checkbox" id="' + id + '" checked> ' + a.name.split(" — ")[0];
    checks.appendChild(lab);
    lab.querySelector("input").addEventListener("change", (ev) => {
      a.enabled = ev.target.checked;
      a.panel.classList.toggle("dim", !a.enabled);
    });
  });

  /* ----------------------------------------------- world ↔ panels */
  function syncAllPanels() {
    for (const a of ALGOS) Graph.syncStructureFrom(a.graph, world);
    redrawAll();
  }
  function redrawAll(transient) {
    for (const a of ALGOS) a.graph.draw(transient);
  }

  /* --------------------------------------------------- mouse handlers */
  // Edit modes: idle | press-empty | press-node | dragging-edge
  let mouseDown = false;
  let downAt = null;     // { x, y, time, node }
  let dragSrc = null;    // node id or null
  let dragSourceCanvas = null;

  function localPos(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function onMouseDown(a, ev) {
    if (ev.button !== 0) return;
    const id = world.nodeAt(ev.clientX, ev.clientY) === null ? null
             : (() => {
                  // world doesn't have a meaningful canvas — use the panel's
                  // local coords to look up nodes by position
                  const p = localPos(a.canvas, ev);
                  for (let i = world.nodes.length - 1; i >= 0; i--) {
                    const n = world.nodes[i];
                    const dx = n.x - p.x, dy = n.y - p.y;
                    if (dx * dx + dy * dy <= world.nodeRadius * world.nodeRadius) return n.id;
                  }
                  return null;
                })();
    const p = localPos(a.canvas, ev);
    mouseDown = true;
    downAt = { x: p.x, y: p.y, time: Date.now(), node: id };
    dragSrc = id;
    dragSourceCanvas = a.canvas;
    if (id != null) a.canvas.classList.add("dragging-edge");
    ev.preventDefault();
  }

  function onMouseMove(a, ev) {
    if (!mouseDown || dragSourceCanvas !== a.canvas) return;
    if (dragSrc == null) return;          // not dragging from a node
    const p = localPos(a.canvas, ev);
    const src = world.getNode(dragSrc);
    if (!src) return;
    redrawAll({ dragLine: { fromX: src.x, fromY: src.y, toX: p.x, toY: p.y } });
  }

  function onMouseUp(a, ev) {
    if (!mouseDown) return;
    mouseDown = false;
    a.canvas.classList.remove("dragging-edge");
    const p = localPos(a.canvas, ev);

    // Find target node at release point (in world coordinates)
    let targetNode = null;
    for (let i = world.nodes.length - 1; i >= 0; i--) {
      const n = world.nodes[i];
      const dx = n.x - p.x, dy = n.y - p.y;
      if (dx * dx + dy * dy <= world.nodeRadius * world.nodeRadius) {
        targetNode = n.id; break;
      }
    }

    const dx = p.x - downAt.x;
    const dy = p.y - downAt.y;
    const moved = Math.hypot(dx, dy);

    if (dragSrc != null && targetNode != null) {
      // edge from dragSrc to targetNode (self-loops allowed)
      world.addEdge(dragSrc, targetNode);
    } else if (dragSrc == null && targetNode == null && moved < 5) {
      // click on empty → add node (only if not too close to an existing node)
      let tooClose = false;
      for (const n of world.nodes) {
        if (Math.hypot(n.x - p.x, n.y - p.y) < world.nodeRadius * 2.2) { tooClose = true; break; }
      }
      if (!tooClose) world.addNode(p.x, p.y);
    }

    dragSrc = null;
    dragSourceCanvas = null;
    syncAllPanels();
    scheduleRun();
  }

  function onContextMenu(a, ev) {
    ev.preventDefault();
    const p = localPos(a.canvas, ev);
    let target = null;
    for (let i = world.nodes.length - 1; i >= 0; i--) {
      const n = world.nodes[i];
      const dx = n.x - p.x, dy = n.y - p.y;
      if (dx * dx + dy * dy <= world.nodeRadius * world.nodeRadius) { target = n.id; break; }
    }
    if (target != null) {
      world.removeNode(target);
      syncAllPanels();
      scheduleRun();
    }
  }

  ALGOS.forEach((a) => {
    a.canvas.addEventListener("mousedown", (ev) => onMouseDown(a, ev));
    a.canvas.addEventListener("mousemove", (ev) => onMouseMove(a, ev));
    a.canvas.addEventListener("mouseup",   (ev) => onMouseUp(a, ev));
    a.canvas.addEventListener("contextmenu", (ev) => onContextMenu(a, ev));
  });
  window.addEventListener("mouseup", () => {
    if (mouseDown) {
      mouseDown = false;
      dragSrc = null;
      dragSourceCanvas = null;
      ALGOS.forEach((x) => x.canvas.classList.remove("dragging-edge"));
      redrawAll();
    }
  });

  /* ----------------------------------------------------------- runner */
  let runners = [];
  let paused = false;
  let speed = 4;
  let rafHandle = null;

  function reset() {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    runners = ALGOS.map((a) => {
      a.graph.clearOverlays();
      Graph.syncStructureFrom(a.graph, world);
      a.resultEl.textContent = "running…";
      a.resultEl.className = "text";
      return {
        algo: a,
        it:   a.gen(world),
        done: false,
        // for ordered colourings — collected during run
        bfsDepths: new Map(),
        dfsFinish: [],
        topoOrder: [],
        topoCycle: null,
        sccGroups: [],
      };
    });
    runners.forEach((r) => r.algo.graph.draw());
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
        applyEvent(r, v);
        if (v.type === "done") { r.done = true; finalize(r, v); break; }
      }

      r.algo.graph.draw();
      if (!r.done) allDone = false;
    }

    if (!allDone) rafHandle = requestAnimationFrame(tick);
    else rafHandle = null;
  }

  function applyEvent(r, v) {
    const g = r.algo.graph;
    if (r.algo.key === "bfs") {
      if (v.type === "visit") {
        r.bfsDepths.set(v.node, v.depth);
        // re-colour the visited set as more depths come in
        const max = Math.max(...r.bfsDepths.values()) || 0;
        for (const [id, d] of r.bfsDepths) {
          g.setNodeColor(id, rampColor(d, max + 1));
          g.setNodeBadge(id, "d=" + d);
        }
      }
    } else if (r.algo.key === "dfs") {
      if (v.type === "discover") {
        g.setNodeColor(v.node, C_LIGHTER);
      } else if (v.type === "finish") {
        r.dfsFinish.push(v.node);
        const total = r.dfsFinish.length;
        for (let i = 0; i < total; i++) {
          g.setNodeColor(r.dfsFinish[i], rampColor(i, total));
          g.setNodeBadge(r.dfsFinish[i], "#" + (i + 1));
        }
      }
    } else if (r.algo.key === "topo") {
      if (v.type === "discover") {
        g.setNodeColor(v.node, C_LIGHTER);
      } else if (v.type === "finish") {
        r.topoOrder.unshift(v.node);     // unshift so order ends up topological
        // recolour by topo position
        for (let i = 0; i < r.topoOrder.length; i++) {
          g.setNodeColor(r.topoOrder[i], rampColor(i, r.topoOrder.length));
          g.setNodeBadge(r.topoOrder[i], (i + 1).toString());
        }
      } else if (v.type === "cycle") {
        r.topoCycle = v;
        g.setNodeColor(v.at, C_RED);
        g.setNodeColor(v.from, C_RED);
        g.setNodeBadge(v.at, "cycle");
      }
    } else if (r.algo.key === "tarjan") {
      if (v.type === "discover") {
        g.setNodeColor(v.node, C_LIGHTER);
      } else if (v.type === "scc") {
        const color = SCC_COLORS[v.index % SCC_COLORS.length];
        for (const id of v.component) {
          g.setNodeColor(id, color);
          g.setNodeBadge(id, v.component.length === 1 ? "" : "scc-" + (v.index + 1));
        }
        r.sccGroups.push(v.component);
      }
    }
  }

  function finalize(r, v) {
    if (r.algo.key === "bfs") {
      r.algo.resultEl.textContent =
        "depth 0..." + (Math.max(...r.bfsDepths.values()) || 0) + " across " + r.bfsDepths.size + " nodes";
      r.algo.resultEl.className = "text ok";
    } else if (r.algo.key === "dfs") {
      r.algo.resultEl.textContent = "finish order: " +
        r.dfsFinish.map((id) => r.algo.graph.getNode(id)?.label).join(" → ");
      r.algo.resultEl.className = "text ok";
    } else if (r.algo.key === "topo") {
      if (v.cycle) {
        r.algo.resultEl.textContent = "cycle detected — no topological order exists";
        r.algo.resultEl.className = "text fail";
      } else {
        r.algo.resultEl.textContent = "topo: " +
          r.topoOrder.map((id) => r.algo.graph.getNode(id)?.label).join(" → ");
        r.algo.resultEl.className = "text ok";
      }
    } else if (r.algo.key === "tarjan") {
      r.algo.resultEl.textContent = r.sccGroups.length + " SCC" +
        (r.sccGroups.length === 1 ? "" : "s") + " · sizes " +
        r.sccGroups.map((c) => c.length).sort((a, b) => b - a).join(", ");
      r.algo.resultEl.className = "text ok";
    }
  }

  // Debounce
  let restartTimer = null;
  function scheduleRun() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { restartTimer = null; reset(); }, 80);
  }

  /* --------------------------------------------------------------- wiring */
  document.getElementById("speed").addEventListener("input", (ev) => {
    speed = +ev.target.value;
    document.getElementById("speed-value").textContent = speed + "×";
  });
  document.getElementById("pause").addEventListener("click", () => {
    paused = !paused;
    document.getElementById("pause").textContent = paused ? "Resume" : "Pause";
    if (!paused && !rafHandle) rafHandle = requestAnimationFrame(tick);
  });
  document.getElementById("reset").addEventListener("click", () => { scheduleRun(); });
  document.getElementById("clear-graph").addEventListener("click", () => {
    world.nodes = [];
    world.byId = new Map();
    world.adj  = new Map();
    world.nextId = 0;
    syncAllPanels();
    scheduleRun();
  });
  document.getElementById("seed-graph").addEventListener("click", () => {
    world.nodes = [];
    world.byId = new Map();
    world.adj  = new Map();
    world.nextId = 0;
    seed();
    syncAllPanels();
    scheduleRun();
  });

  window.addEventListener("resize", () => {
    ALGOS.forEach((a) => { a.graph.fitCanvas(); a.graph.draw(); });
  });

  /* --------------------------------------------------------------- launch */
  requestAnimationFrame(() => {
    ALGOS.forEach((a) => { a.graph.fitCanvas(); a.graph.draw(); });
    reset();
  });
})();
