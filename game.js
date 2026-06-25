const GRID_SIZE = 4;
let grid, score, best, won;

const tileContainer = document.getElementById('tile-container');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('game-over');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');

function init() {
  grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  score = 0;
  won = false;
  best = parseInt(localStorage.getItem('2048-best') || '0');
  updateScore();
  tileContainer.innerHTML = '';
  addRandom();
  addRandom();
  renderTiles();
  overlay.classList.add('hidden');
}

function addRandom() {
  const empty = [];
  grid.forEach((row, r) => row.forEach((val, c) => { if (!val) empty.push([r, c]); }));
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

function renderTiles() {
  const containerRect = tileContainer.getBoundingClientRect();
  const gap = 12;
  const size = (containerRect.width - gap * (GRID_SIZE - 1)) / GRID_SIZE;

  tileContainer.innerHTML = '';
  grid.forEach((row, r) => {
    row.forEach((val, c) => {
      if (!val) return;
      const tile = document.createElement('div');
      tile.className = `tile tile-${val <= 2048 ? val : 'super'}`;
      tile.textContent = val;
      const fontSize = val < 100 ? size * 0.45 : val < 1000 ? size * 0.35 : size * 0.27;
      tile.style.fontSize = `${fontSize}px`;
      tile.style.width = `${size}px`;
      tile.style.height = `${size}px`;
      tile.style.left = `${c * (size + gap)}px`;
      tile.style.top = `${r * (size + gap)}px`;
      tileContainer.appendChild(tile);
    });
  });
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem('2048-best', best);
  }
  bestEl.textContent = best;
}

function slide(row) {
  let arr = row.filter(v => v);
  let merged = false;
  for (let i = 0; i < arr.length - 1; i++) {
    if (!merged && arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      score += arr[i];
      if (arr[i] === 2048 && !won) won = true;
      arr.splice(i + 1, 1);
      merged = true;
    } else {
      merged = false;
    }
  }
  while (arr.length < GRID_SIZE) arr.push(0);
  return arr;
}

function moveDir(dir) {
  const prev = JSON.stringify(grid);

  if (dir === 'left') {
    grid = grid.map(row => slide([...row]));
  } else if (dir === 'right') {
    grid = grid.map(row => slide([...row].reverse()).reverse());
  } else if (dir === 'up') {
    const t = transpose(grid);
    grid = transpose(t.map(col => slide([...col])));
  } else if (dir === 'down') {
    const t = transpose(grid);
    grid = transpose(t.map(col => slide([...col].reverse()).reverse()));
  }

  if (JSON.stringify(grid) === prev) return;

  updateScore();
  addRandom();
  renderTiles();

  if (won) {
    showOverlay('You Win!');
    won = false;
    return;
  }
  if (isGameOver()) {
    showOverlay('Game Over!');
  }
}

function transpose(matrix) {
  return matrix[0].map((_, c) => matrix.map(row => row[c]));
}

function isGameOver() {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) return false;
      if (c < GRID_SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
      if (r < GRID_SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
    }
  }
  return true;
}

function showOverlay(title) {
  overlayTitle.textContent = title;
  overlayScore.textContent = `Score: ${score}`;
  overlay.classList.remove('hidden');
}

// Keyboard
document.addEventListener('keydown', e => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (map[e.key]) { e.preventDefault(); moveDir(map[e.key]); }
});

// Touch / swipe
let touchStart = null;
document.addEventListener('touchstart', e => { touchStart = e.touches[0]; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX;
  const dy = e.changedTouches[0].clientY - touchStart.clientY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) moveDir(dx > 0 ? 'right' : 'left');
  else moveDir(dy > 0 ? 'down' : 'up');
  touchStart = null;
}, { passive: true });

document.getElementById('new-game').addEventListener('click', init);
document.getElementById('retry').addEventListener('click', init);

window.addEventListener('resize', renderTiles);
init();
