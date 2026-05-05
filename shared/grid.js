/* ============================================================================
 * shared/grid.js — reusable 2-D cell grid widget.
 *
 * Used by:
 *   - 02-pathfinding (walls + start + goal + per-cell visited / path overlay)
 *   - 03-maze        (walls only)
 *   - … any future page that needs a grid canvas with mouse painting.
 *
 * Public API:
 *
 *   const grid = new Grid(canvas, { cols, rows });
 *   grid.cols / grid.rows
 *   grid.setWall(r, c, on) / grid.isWall(r, c) / grid.clearWalls()
 *   grid.setStart(r, c) / grid.setGoal(r, c)        // optional special cells
 *   grid.setOverlay(r, c, color, alpha)             // per-cell tint, layered above walls
 *   grid.clearOverlays()
 *   grid.draw()                                     // render to canvas
 *   grid.cellAt(clientX, clientY)                   // returns {r, c} or null
 *
 * The widget does not own mouse events; the page wires them up and decides
 * what edits mean (paint vs erase vs move-marker vs nothing).  Keeps the
 * Grid focused on rendering + storage.
 *
 * Palette: read from CSS custom properties at construction time.  Falls back
 * to hard-coded values if the page hasn't loaded the shared stylesheet.
 *
 * Coordinate convention: row 0 is the TOP, col 0 is LEFT.
 * ========================================================================== */

/* eslint-env browser */

(function (global) {
  "use strict";

  function readCss(name, fallback) {
    if (typeof window === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  class Grid {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.cols = opts.cols | 0 || 30;
      this.rows = opts.rows | 0 || 22;
      this.walls = new Uint8Array(this.cols * this.rows);
      this.start = null;
      this.goal = null;
      this.overlays = new Map();    // "r,c" -> { color, alpha }
      this.gridLines = opts.gridLines !== false;

      // palette
      this.colors = {
        bg:      readCss("--bg",      "#FFFFFF"),
        wall:    readCss("--text",    "#333333"),
        gridln:  readCss("--grid",    "#E5E5E5"),
        start:   readCss("--title",   "#3B6EA8"),
        goal:    readCss("--accent",  "#C04040"),
        marker:  "#FFFFFF",
      };

      this.fitCanvas();
      this._cellSize = this.computeCellSize();
    }

    /* ----------------------------------------------------- storage helpers */
    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }
    idx(r, c) { return r * this.cols + c; }
    keyOf(r, c) { return r + "," + c; }

    isWall(r, c)  { return !!this.walls[this.idx(r, c)]; }
    setWall(r, c, on) {
      if (!this.inBounds(r, c)) return false;
      const v = on ? 1 : 0;
      const cur = this.walls[this.idx(r, c)];
      if (cur === v) return false;
      this.walls[this.idx(r, c)] = v;
      return true;                  // changed
    }
    clearWalls() { this.walls.fill(0); }

    setStart(r, c) {
      if (!this.inBounds(r, c)) return;
      this.start = { r, c };
      this.walls[this.idx(r, c)] = 0;     // start can't be on a wall
    }
    setGoal(r, c) {
      if (!this.inBounds(r, c)) return;
      this.goal = { r, c };
      this.walls[this.idx(r, c)] = 0;
    }

    isStart(r, c) { return this.start && this.start.r === r && this.start.c === c; }
    isGoal(r, c)  { return this.goal  && this.goal.r  === r && this.goal.c  === c; }

    setOverlay(r, c, color, alpha) {
      if (!this.inBounds(r, c)) return;
      this.overlays.set(this.keyOf(r, c), { color, alpha: alpha == null ? 1 : alpha });
    }
    clearOverlays() { this.overlays.clear(); }

    /* ----------------------------------------------------- canvas sizing */
    fitCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._cellSize = this.computeCellSize();
    }

    computeCellSize() {
      const rect = this.canvas.getBoundingClientRect();
      return Math.min(rect.width / this.cols, rect.height / this.rows);
    }

    cellAt(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const s = this._cellSize;
      if (s <= 0) return null;
      const c = Math.floor(x / s);
      const r = Math.floor(y / s);
      if (!this.inBounds(r, c)) return null;
      return { r, c };
    }

    /* --------------------------------------------------------- rendering */
    draw() {
      const ctx = this.ctx;
      const s = this._cellSize;
      const W = this.cols * s;
      const H = this.rows * s;

      // background
      ctx.fillStyle = this.colors.bg;
      ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

      // walls
      ctx.fillStyle = this.colors.wall;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.walls[this.idx(r, c)]) {
            ctx.fillRect(c * s, r * s, s, s);
          }
        }
      }

      // overlays (visited / path / frontier — page sets these)
      for (const [key, sty] of this.overlays) {
        const i = key.indexOf(",");
        const r = +key.slice(0, i);
        const c = +key.slice(i + 1);
        ctx.globalAlpha = sty.alpha;
        ctx.fillStyle = sty.color;
        ctx.fillRect(c * s, r * s, s, s);
      }
      ctx.globalAlpha = 1;

      // grid lines
      if (this.gridLines && s > 4) {
        ctx.strokeStyle = this.colors.gridln;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let r = 0; r <= this.rows; r++) {
          const y = r * s + 0.5;
          ctx.moveTo(0, y); ctx.lineTo(W, y);
        }
        for (let c = 0; c <= this.cols; c++) {
          const x = c * s + 0.5;
          ctx.moveTo(x, 0); ctx.lineTo(x, H);
        }
        ctx.stroke();
      }

      // start / goal markers — drawn last so they sit on top of everything
      this._drawMarker(this.start, this.colors.start, "S");
      this._drawMarker(this.goal,  this.colors.goal,  "G");
    }

    _drawMarker(cell, fill, label) {
      if (!cell) return;
      const ctx = this.ctx;
      const s = this._cellSize;
      const x = cell.c * s;
      const y = cell.r * s;
      const pad = Math.max(1, s * 0.08);
      ctx.fillStyle = fill;
      ctx.fillRect(x + pad, y + pad, s - 2 * pad, s - 2 * pad);
      ctx.fillStyle = this.colors.marker;
      ctx.font = "700 " + Math.floor(s * 0.65) + "px " +
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + s / 2, y + s / 2 + 1);
    }
  }

  /* ----------------------------------------------- syncing two grids' walls */
  // Convenience: copy wall + start + goal state from src to dst (e.g. when
  // pathfinding has 4 panels and editing one should mirror to the others).
  Grid.syncStateFrom = function (dst, src) {
    if (dst.cols !== src.cols || dst.rows !== src.rows) return false;
    dst.walls.set(src.walls);
    dst.start = src.start ? { r: src.start.r, c: src.start.c } : null;
    dst.goal  = src.goal  ? { r: src.goal.r,  c: src.goal.c  } : null;
    return true;
  };

  global.Grid = Grid;
})(typeof window !== "undefined" ? window : globalThis);
