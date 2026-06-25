# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step or dependencies. Open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no tests or linting tools configured.

## Architecture

The entire game lives in three files with no framework or build system:

- **`index.html`** — Static markup only. Two layers inside `.grid-container`: a `.grid-background` of static empty `.cell` divs (purely visual), and a `#tile-container` (absolutely positioned) where live tile DOM elements are injected and moved by JS.
- **`game.js`** — All game logic. No modules; runs as a plain script after the DOM.
- **`style.css`** — Two complete themes via CSS custom properties: dark neon (`:root` default) and light classic (`body.light`).

### game.js internals

State is held in module-level variables: `tiles` (array of `{id, value, row, col}` objects), `nextId`, `score`, `best`, `won`, `animating`.

The move pipeline (`moveDir` → `processLine`):
1. `buildGrid()` projects `tiles` array into a 2D grid for lookup.
2. Each row/column is extracted as an ordered array and passed to `processLine`, which computes slides and merges without touching the DOM.
3. CSS `transform: translate(x, y)` is applied to tile elements to animate movement (GPU-accelerated via `will-change: transform`).
4. After `ANIM_MS` (120 ms), merged originals are removed, new merged tiles are appended with the `.merged` class (pop animation), and a new random tile spawns with `.new` (appear animation).

Tile positioning is pixel-based: `px(r, c, size)` computes `left`/`top` from row/col using a fixed `GAP` (12 px) and a dynamically measured `cellSize()`. `repositionAll()` recalculates on window resize without triggering transitions.

Tile values above 2048 receive the class `tile-super` instead of `tile-{value}`.

Theme and best score persist to `localStorage` under keys `2048-theme` and `2048-best`.
