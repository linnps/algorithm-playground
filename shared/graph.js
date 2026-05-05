/* ============================================================================
 * shared/graph.js — reusable directed-graph widget for canvas pages.
 *
 * Used by:
 *   - 04-graph (BFS / DFS / topo sort / Tarjan SCC)
 *   - 05-trees (planned: each tree is a graph with constrained layout)
 *
 * Public API:
 *   const g = new Graph(canvas, { nodeRadius?, palette? });
 *
 *   // structure
 *   g.addNode(x, y, label?)             → node id
 *   g.removeNode(id)
 *   g.addEdge(fromId, toId)             → boolean (false on duplicate)
 *   g.removeEdge(fromId, toId)
 *   g.hasEdge(fromId, toId)             → boolean
 *   g.outNeighbors(id)                  → array of ids
 *   g.inNeighbors(id)                   → array of ids
 *   g.nodeIds()                         → array of ids in insertion order
 *   g.getNode(id)                       → {id, x, y, label} or undefined
 *
 *   // visualisation overlays (cleared by clearOverlays)
 *   g.setNodeColor(id, fill)
 *   g.setNodeBadge(id, text)            → small text under node
 *   g.markEdge(fromId, toId, color)     → highlight edge
 *   g.clearOverlays()
 *
 *   // rendering
 *   g.draw()
 *   g.fitCanvas()                       → call on resize
 *
 *   // mouse helpers
 *   g.nodeAt(clientX, clientY)          → node id or null
 *   g.cellAt(clientX, clientY)          → {x, y} canvas-local coords
 *
 *   // for multi-panel sync (mirror the structure across N panels)
 *   Graph.syncStructureFrom(dst, src)
 *
 * Self-loops are supported (rendered as small arc above the node).
 * Bidirectional edges are rendered as two slightly-curved arrows.
 * ========================================================================== */

(function (global) {
  "use strict";

  function readCss(name, fallback) {
    if (typeof window === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  class Graph {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.nodes = [];                 // {id, x, y, label}
      this.byId = new Map();           // id → node ref
      this.adj = new Map();            // id → Set<id> (out-neighbours)
      this.nextId = 0;

      this.nodeRadius = opts.nodeRadius || 18;
      this.colors = {
        bg:        readCss("--bg",      "#FFFFFF"),
        gridln:    readCss("--grid",    "#E5E5E5"),
        node:      readCss("--bg",      "#FFFFFF"),
        nodeBorder:readCss("--text",    "#333333"),
        nodeText:  readCss("--text",    "#333333"),
        edge:      readCss("--muted",   "#7A7A7A"),
        title:     readCss("--title",   "#3B6EA8"),
        accent:    readCss("--accent",  "#C04040"),
      };

      // overlays — cleared by clearOverlays(), set by algorithms during run
      this.nodeColor = new Map();      // id → fill
      this.nodeBadge = new Map();      // id → text
      this.edgeColor = new Map();      // "from→to" → color

      this.fitCanvas();
    }

    /* ---------------------------------------------------------- canvas */
    fitCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* -------------------------------------------------- structure ops */
    addNode(x, y, label) {
      const id = this.nextId++;
      const idLabel = label || String.fromCharCode(65 + (id % 26))
        + (id >= 26 ? Math.floor(id / 26) : "");
      const node = { id, x, y, label: idLabel };
      this.nodes.push(node);
      this.byId.set(id, node);
      this.adj.set(id, new Set());
      return id;
    }

    removeNode(id) {
      if (!this.byId.has(id)) return;
      // remove from this.nodes
      this.nodes = this.nodes.filter((n) => n.id !== id);
      this.byId.delete(id);
      this.adj.delete(id);
      // strip incident edges from other adj-sets
      for (const set of this.adj.values()) set.delete(id);
      // strip overlays
      this.nodeColor.delete(id);
      this.nodeBadge.delete(id);
      for (const k of [...this.edgeColor.keys()]) {
        const [a, b] = k.split("→").map(Number);
        if (a === id || b === id) this.edgeColor.delete(k);
      }
    }

    addEdge(from, to) {
      if (!this.byId.has(from) || !this.byId.has(to)) return false;
      const set = this.adj.get(from);
      if (set.has(to)) return false;
      set.add(to);
      return true;
    }

    removeEdge(from, to) {
      const set = this.adj.get(from);
      if (!set) return;
      set.delete(to);
      this.edgeColor.delete(from + "→" + to);
    }

    hasEdge(from, to)    { return this.adj.get(from)?.has(to) || false; }
    outNeighbors(id)     { return [...(this.adj.get(id) || [])]; }
    inNeighbors(id) {
      const out = [];
      for (const [from, set] of this.adj) if (set.has(id)) out.push(from);
      return out;
    }
    nodeIds()            { return this.nodes.map((n) => n.id); }
    getNode(id)          { return this.byId.get(id); }
    nodeCount()          { return this.nodes.length; }
    edgeCount() {
      let c = 0;
      for (const set of this.adj.values()) c += set.size;
      return c;
    }

    /* ----------------------------------------------- visualisation API */
    setNodeColor(id, fill) { if (this.byId.has(id)) this.nodeColor.set(id, fill); }
    setNodeBadge(id, text) { if (this.byId.has(id)) this.nodeBadge.set(id, String(text)); }
    markEdge(from, to, color) {
      if (this.hasEdge(from, to)) this.edgeColor.set(from + "→" + to, color);
    }
    clearOverlays() {
      this.nodeColor.clear();
      this.nodeBadge.clear();
      this.edgeColor.clear();
    }

    /* ---------------------------------------------------------- mouse */
    nodeAt(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      // iterate in reverse order so most-recently-added node wins overlap
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy <= this.nodeRadius * this.nodeRadius) return n.id;
      }
      return null;
    }
    cellAt(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    /* ----------------------------------------------------- rendering */
    draw(transientOverlay) {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      ctx.fillStyle = this.colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Edges first so nodes overlap them.
      for (const [from, set] of this.adj) {
        for (const to of set) {
          const color = this.edgeColor.get(from + "→" + to) || this.colors.edge;
          this._drawEdge(from, to, color);
        }
      }

      // Transient drag-line preview (when user is dragging from a node)
      if (transientOverlay && transientOverlay.dragLine) {
        const { fromX, fromY, toX, toY } = transientOverlay.dragLine;
        ctx.strokeStyle = this.colors.title;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Nodes on top
      for (const n of this.nodes) {
        this._drawNode(n);
      }
    }

    _drawNode(n) {
      const ctx = this.ctx;
      const r = this.nodeRadius;
      const fill = this.nodeColor.get(n.id) || this.colors.node;
      ctx.fillStyle = fill;
      ctx.strokeStyle = this.colors.nodeBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // text inside
      ctx.fillStyle = this._textOnFill(fill);
      ctx.font = "700 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, n.x, n.y);

      // badge below
      const badge = this.nodeBadge.get(n.id);
      if (badge) {
        ctx.fillStyle = this.colors.accent;
        ctx.font = "600 10px ui-monospace, Menlo, Monaco, monospace";
        ctx.fillText(badge, n.x, n.y + r + 9);
      }
    }

    _textOnFill(fillHex) {
      // Pick black or white text by perceived brightness
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(fillHex);
      if (!m) return this.colors.nodeText;
      const r = parseInt(m[1], 16);
      const g = parseInt(m[2], 16);
      const b = parseInt(m[3], 16);
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luma > 0.6 ? "#1a1a1a" : "#ffffff";
    }

    _drawEdge(from, to, color) {
      const ctx = this.ctx;
      const a = this.byId.get(from);
      const b = this.byId.get(to);
      if (!a || !b) return;
      const r = this.nodeRadius;

      // self-loop
      if (a === b) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // arc above the node
        const cx = a.x;
        const cy = a.y - r - 6;
        ctx.arc(cx, cy, r * 0.7, Math.PI * 0.25, Math.PI * 0.75 + 2 * Math.PI - 0.5, false);
        ctx.stroke();
        // arrowhead
        const tx = a.x + r * 0.55, ty = a.y - r * 0.85;
        this._arrowhead(tx, ty, Math.PI * 1.7, color);
        return;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < r * 2 + 2) return;
      const ux = dx / d, uy = dy / d;

      // shrink endpoints to circle perimeters
      const sx = a.x + ux * r;
      const sy = a.y + uy * r;
      const ex = b.x - ux * r;
      const ey = b.y - uy * r;

      // if reverse edge exists, draw a slight curve so they don't overlap
      const reverseExists = this.adj.get(to)?.has(from);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (reverseExists) {
        // perpendicular offset for the bezier control point
        const px = -uy, py = ux;       // unit perpendicular
        const offset = 18;
        const mx = (sx + ex) / 2 + px * offset;
        const my = (sy + ey) / 2 + py * offset;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
      } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();

      // arrowhead at destination
      const angle = Math.atan2(ey - sy, ex - sx);
      this._arrowhead(ex, ey, angle, color);
    }

    _arrowhead(x, y, angle, color) {
      const ctx = this.ctx;
      const len = 8;
      const ang = 0.5;          // half-angle of arrowhead
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * Math.cos(angle - ang), y - len * Math.sin(angle - ang));
      ctx.lineTo(x - len * Math.cos(angle + ang), y - len * Math.sin(angle + ang));
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------------------------------------------- multi-panel sync */
  Graph.syncStructureFrom = function (dst, src) {
    dst.nodes = [];
    dst.byId  = new Map();
    dst.adj   = new Map();
    dst.nextId = src.nextId;
    for (const n of src.nodes) {
      const node = { id: n.id, x: n.x, y: n.y, label: n.label };
      dst.nodes.push(node);
      dst.byId.set(n.id, node);
      dst.adj.set(n.id, new Set([...src.adj.get(n.id) || []]));
    }
    dst.clearOverlays();
  };

  global.Graph = Graph;
})(typeof window !== "undefined" ? window : globalThis);
