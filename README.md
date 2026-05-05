<div align="center">

# 🎮 Algorithm Playground

**Interactive CS algorithm visualizations · pure HTML/JS · runs anywhere · no build step**

[![Live site](https://img.shields.io/badge/live-linnps.github.io%2Falgorithm--playground-3B6EA8?style=flat-square)](https://linnps.github.io/algorithm-playground/)
[![Status](https://img.shields.io/badge/status-3%2F10%20live-3B6EA8?style=flat-square)](https://linnps.github.io/algorithm-playground/)
[![License](https://img.shields.io/badge/license-MIT-7A7A7A?style=flat-square)](LICENSE)

</div>

---

## What this is

Ten classic CS algorithms, each rendered as a live interactive demo. Pick any
card on the [landing page](https://linnps.github.io/algorithm-playground/) and
watch the algorithm execute step-by-step — no installs, no server, no LLM API,
runs entirely in your browser.

This is a companion to my [ML portfolio](https://github.com/linnps?tab=repositories&q=ml-)
on the engineering side: where ML repos demonstrate model-building from
scratch, this shows algorithmic thinking from scratch — same blue / red / gray
palette, same "boring code, sharp insights" philosophy.

---

## Status

| #  | Algorithm | Demo | Notes |
|----|-----------|------|-------|
| 01 | **Sorting Race** — bubble · insertion · selection · merge · quick · heap | [🟢 live](https://linnps.github.io/algorithm-playground/01-sorting/) | Six algorithms racing on the same array. ES6 generators + canvas. |
| 02 | **Pathfinding** — A* · Dijkstra · BFS · DFS | [🟢 live](https://linnps.github.io/algorithm-playground/02-pathfinding/) | Drag walls onto a shared grid; four algorithms explore in 2×2 panels. |
| 03 | **Maze generation** — DFS · Prim's · Kruskal's · Wilson's | [🟢 live](https://linnps.github.io/algorithm-playground/03-maze/) | Same all-walls grid; each algorithm carves a visibly different style. |
| 04 | Graph traversal — BFS · DFS · topological sort · Tarjan SCC | 🟡 planned | Build-your-own directed graph. |
| 05 | Self-balancing trees — BST · AVL · Red-Black | 🟡 planned | Side-by-side rotation visualizer. |
| 06 | Hash tables — chaining · linear probing · cuckoo | 🟡 planned | Collision-density slider. |
| 07 | Heap & priority queue | 🟡 planned | Sift-up / sift-down + heapsort vs quicksort. |
| 08 | Dynamic programming — LCS · edit distance · knapsack | 🟡 planned | DP table animated cell-by-cell. |
| 09 | String matching — KMP · Rabin-Karp · vs naive | 🟡 planned | Failure function build + match. |
| 10 | Computational geometry — Graham scan convex hull | 🟡 planned | Click to drop points. |

---

## Stack

- **Pure HTML / CSS / JS** — no React, no Vue, no bundler, no `npm install`.
  Open any `*.html` file in a browser, it just works.
- **HTML5 Canvas** for high-FPS animation (sorting bars, future pathfinding sweep).
- **ES6 generators** for step-by-step algorithm execution — each algorithm is
  written in its natural form with `yield` at the points the UI should pause.
- **CSS custom properties** for the palette so the entire site is themable
  by editing one file (`shared/style.css`).
- Hosted on **GitHub Pages** straight off `main`, no CI, no preview environments.

---

## Project layout

```
algorithm-playground/
├── index.html              ← landing page: 10-card grid
├── shared/
│   ├── style.css           ← palette + typography + components
│   ├── nav.js              ← top navigation injector
│   └── footer.js
├── 01-sorting/             ← live
│   ├── index.html
│   ├── sorting.css
│   └── sorting.js          ← 6 algos as generators + canvas renderer
├── 02-pathfinding/         ← live
│   ├── index.html
│   ├── pathfinding.css
│   └── pathfinding.js      ← BFS / DFS / Dijkstra / A* on shared grid
├── 03-maze/                ← live
│   ├── index.html
│   ├── maze.css
│   └── maze.js             ← DFS backtracker / Prim / Kruskal / Wilson
├── shared/grid.js          ← reusable grid widget (used by #02 and #03)
├── 04-graph/ ... 10-geometry/  ← stubs ("coming soon")
├── README.md
├── LICENSE                 ← MIT
└── .nojekyll               ← skip Jekyll on Pages
```

---

## Run locally

```bash
git clone https://github.com/linnps/algorithm-playground.git
cd algorithm-playground
open index.html        # macOS
# or:  xdg-open index.html on Linux, start index.html on Windows
```

That's it. There's literally nothing to install or build.

For development, any static file server works equally well:

```bash
python3 -m http.server 8080      # → http://localhost:8080/
```

---

## Design principles

These were locked in at project start — see
[`journal-3.md`](https://github.com/linnps/algorithm-playground) (private)
for the full handoff doc. Short version:

- **No build tooling, ever.** Code stays inspectable. Repo stays runnable.
- **Same palette across every demo.** Visual continuity ties the portfolio together.
- **Generators + canvas.** Every algorithm is an ES6 generator yielding
  state snapshots; a single animation loop drives all panels in lockstep.
- **One repo, one URL.** Visitor opens
  [linnps.github.io/algorithm-playground/](https://linnps.github.io/algorithm-playground/)
  and gets the whole tour from the landing page.

---

## Roadmap

Each subsequent session converts one stub into a working demo, in this order:
**Pathfinding → Maze → Graph → Trees → Heap → Hash → DP → Strings → Geometry.**
The order is chosen to maximize code reuse — later algorithms inherit
infrastructure (grid renderer, tree layout, etc.) built earlier.

When all 10 are live, this README becomes the index page everyone reads;
when only 1 is live (today), the live one is the showcase.

---

<div align="center">
<sub>Part of the
<a href="https://github.com/linnps">linnps</a>
GitHub portfolio · same palette as the
<a href="https://github.com/linnps?tab=repositories&q=ml-">ml-XX repos</a>
and the
<a href="https://github.com/linnps/linnps">profile cards</a>.</sub>
</div>
