const GRID_SIZE = 4;
const GAP = 12;
const ANIM_MS = 120;

let tiles, nextId, score, best, won, animating;

const tileContainer = document.getElementById('tile-container');
const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best');
const overlay      = document.getElementById('game-over');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');

// ── layout helpers ─────────────────────────────────────────────────────────────

function cellSize() {
  return (tileContainer.getBoundingClientRect().width - GAP * (GRID_SIZE - 1)) / GRID_SIZE;
}

function px(r, c, size) {
  return { left: c * (size + GAP), top: r * (size + GAP) };
}

function fontSize(val, size) {
  return val < 100 ? size * 0.45 : val < 1000 ? size * 0.35 : size * 0.27;
}

// ── tile DOM ───────────────────────────────────────────────────────────────────

function setTransform(el, r, c, size) {
  const { left, top } = px(r, c, size);
  el.style.transform = `translate(${left}px,${top}px)`;
}

function makeTileEl(tile, size) {
  const el = document.createElement('div');
  el.className = `tile tile-${tile.value <= 2048 ? tile.value : 'super'}`;
  el.dataset.id = tile.id;
  el.textContent = tile.value;
  el.style.width     = `${size}px`;
  el.style.height    = `${size}px`;
  el.style.fontSize  = `${fontSize(tile.value, size)}px`;
  // set position without triggering transition (element not in DOM yet)
  setTransform(el, tile.row, tile.col, size);
  return el;
}

function getTileEl(id) {
  return tileContainer.querySelector(`[data-id="${id}"]`);
}

function repositionAll() {
  const size = cellSize();
  tiles.forEach(t => {
    const el = getTileEl(t.id);
    if (!el) return;
    el.style.transition = 'none'; // skip animation on resize
    el.style.width      = `${size}px`;
    el.style.height     = `${size}px`;
    el.style.fontSize   = `${fontSize(t.value, size)}px`;
    setTransform(el, t.row, t.col, size);
    // re-enable transition after paint
    requestAnimationFrame(() => { el.style.transition = ''; });
  });
}

// ── game state ─────────────────────────────────────────────────────────────────

function init() {
  tiles     = [];
  nextId    = 0;
  score     = 0;
  won       = false;
  animating = false;
  best      = parseInt(localStorage.getItem('2048-best') || '0');
  bestEl.textContent = best;
  scoreEl.textContent = 0;
  tileContainer.innerHTML = '';
  spawnRandom(false);
  spawnRandom(false);
  overlay.classList.add('hidden');
}

function spawnRandom(animate) {
  const occupied = new Set(tiles.map(t => `${t.row},${t.col}`));
  const empty = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!occupied.has(`${r},${c}`)) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const tile = { id: nextId++, value: Math.random() < 0.9 ? 2 : 4, row: r, col: c };
  tiles.push(tile);
  const el = makeTileEl(tile, cellSize());
  el.style.transition = 'none'; // block the transform transition while placing
  tileContainer.appendChild(el);
  if (animate) {
    void el.offsetWidth; // force reflow so 'transition:none' is committed
    el.style.transition = '';
    el.classList.add('new');
  }
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('2048-best', best);
    bestEl.textContent = best;
  }
}

function isGameOver() {
  const grid = buildGrid();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) return false;
      if (c < GRID_SIZE - 1 && grid[r][c].value === grid[r][c+1].value) return false;
      if (r < GRID_SIZE - 1 && grid[r][c].value === grid[r+1][c].value) return false;
    }
  return true;
}

function showOverlay(title) {
  overlayTitle.textContent = title;
  overlayScore.textContent = `Score: ${score}`;
  overlay.classList.remove('hidden');
}

// ── move logic ─────────────────────────────────────────────────────────────────

function buildGrid() {
  const g = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  tiles.forEach(t => { g[t.row][t.col] = t; });
  return g;
}

function processLine(line, posFn) {
  // line: ordered array of tile objects; posFn(i) => {r, c}
  const slides  = []; // {tileId, toRow, toCol}
  const merges  = []; // {id1, id2, toRow, toCol, value}
  const removed = new Set();
  const spawned = []; // {value, row, col}

  let write = 0, i = 0;
  while (i < line.length) {
    const pos = posFn(write);
    if (i + 1 < line.length && line[i].value === line[i+1].value) {
      const val = line[i].value * 2;
      merges.push({ id1: line[i].id, id2: line[i+1].id, toRow: pos.r, toCol: pos.c, value: val });
      removed.add(line[i].id);
      removed.add(line[i+1].id);
      spawned.push({ value: val, row: pos.r, col: pos.c });
      score += val;
      if (val === 2048 && !won) won = true;
      i += 2;
    } else {
      slides.push({ tileId: line[i].id, toRow: pos.r, toCol: pos.c });
      i++;
    }
    write++;
  }
  return { slides, merges, removed, spawned };
}

function moveDir(dir) {
  if (animating) return;

  const grid    = buildGrid();
  const allSlides  = [];
  const allMerges  = [];
  const allRemoved = new Set();
  const allSpawned = [];

  const collectLine = (line, posFn) => {
    const { slides, merges, removed, spawned } = processLine(line, posFn);
    allSlides.push(...slides);
    allMerges.push(...merges);
    removed.forEach(id => allRemoved.add(id));
    allSpawned.push(...spawned);
  };

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < GRID_SIZE; r++) {
      const cols = dir === 'left' ? [0,1,2,3] : [3,2,1,0];
      const line = cols.map(c => grid[r][c]).filter(Boolean);
      collectLine(line, i => ({ r, c: dir === 'left' ? i : GRID_SIZE-1-i }));
    }
  } else {
    for (let c = 0; c < GRID_SIZE; c++) {
      const rows = dir === 'up' ? [0,1,2,3] : [3,2,1,0];
      const line = rows.map(r => grid[r][c]).filter(Boolean);
      collectLine(line, i => ({ r: dir === 'up' ? i : GRID_SIZE-1-i, c }));
    }
  }

  // no-op check
  const moved = allMerges.length > 0 || allSlides.some(({ tileId, toRow, toCol }) => {
    const t = tiles.find(t => t.id === tileId);
    return t.row !== toRow || t.col !== toCol;
  });
  if (!moved) return;

  animating = true;
  const size = cellSize();

  // kick off GPU-accelerated transitions
  allSlides.forEach(({ tileId, toRow, toCol }) => {
    const el = getTileEl(tileId);
    if (!el) return;
    setTransform(el, toRow, toCol, size);
    const t = tiles.find(t => t.id === tileId);
    t.row = toRow; t.col = toCol;
  });

  allMerges.forEach(({ id1, id2, toRow, toCol }) => {
    [id1, id2].forEach(id => {
      const el = getTileEl(id);
      if (!el) return;
      el.style.zIndex = '5';
      setTransform(el, toRow, toCol, size);
    });
  });

  setTimeout(() => {
    // remove merged originals
    allRemoved.forEach(id => getTileEl(id)?.remove());
    tiles = tiles.filter(t => !allRemoved.has(t.id));

    // add merged result tiles
    allSpawned.forEach(({ value, row, col }) => {
      const tile = { id: nextId++, value, row, col };
      tiles.push(tile);
      const el = makeTileEl(tile, cellSize());
      el.classList.add('merged');
      tileContainer.appendChild(el);
    });

    updateScore();
    spawnRandom(true);
    animating = false;

    if (won) { showOverlay('You Win!'); won = false; return; }
    if (isGameOver()) showOverlay('Game Over!');
  }, ANIM_MS);
}

// ── input ──────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
  if (map[e.key]) { e.preventDefault(); moveDir(map[e.key]); }
});

const gameGrid = document.querySelector('.grid-container');
let touchStart = null;

// non-passive so preventDefault() actually suppresses the browser scroll gesture
gameGrid.addEventListener('touchstart', e => {
  e.preventDefault();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });

gameGrid.addEventListener('touchmove', e => {
  e.preventDefault();
}, { passive: false });

gameGrid.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  moveDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});

document.getElementById('new-game').addEventListener('click', init);
document.getElementById('retry').addEventListener('click', init);
window.addEventListener('resize', repositionAll);


window.addEventListener('load', init);
