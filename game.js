'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
  '#424242', // bomba
];

// Paleta más saturada para fondo claro (mismos índices que COLORS)
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#607d8b', // N
  '#212121', // bomba
];

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
  [[9]],                                       // bomba (ítem especial, siempre el último índice)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const BOMB = 9;
const BOMB_CHANCE = 0.1;
const BOMB_POINTS = 10;
const EXPLOSION_MS = 400;
const SPARK_COUNT = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const controlsBtn = document.getElementById('pause-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');

let theme = 'dark';
let startLevel = 1, gameStartLevel = 1;
let gridColor, highlightColor, ghostAlpha, palette = COLORS;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, explosions;

function levelInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < BOMB_CHANCE ? BOMB : Math.floor(Math.random() * (BOMB - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// La bomba no se fusiona con el tablero: borra el área 3×3 alrededor de donde aterriza
function explode() {
  let destroyed = 0;
  for (let r = current.y - 1; r <= current.y + 1; r++) {
    for (let c = current.x - 1; c <= current.x + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }
  score += destroyed * BOMB_POINTS * level;
  updateHUD();
  explosions.push({ x: current.x, y: current.y, start: performance.now(), sparks: makeSparks() });
}

// Se generan una sola vez por explosión para que no parpadeen entre frames
function makeSparks() {
  return Array.from({ length: SPARK_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    speed: 0.8 + Math.random() * 1.2,
  }));
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = gameStartLevel + Math.floor(lines / 10);
    dropInterval = levelInterval(level);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === BOMB) explode();
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = palette[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  if (colorIndex === BOMB) {
    const cx = x * size + size / 2;
    const cy = y * size + size / 2 + 2;
    const rad = size / 2 - 4;
    context.beginPath();
    context.arc(cx, cy, rad, 0, Math.PI * 2);
    context.fill();
    // mecha
    context.strokeStyle = '#ff7043';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy - rad);
    context.lineTo(cx + 4, cy - rad - 4);
    context.stroke();
    context.globalAlpha = 1;
    return;
  }
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = highlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawExplosions();
}

function drawExplosions() {
  const now = performance.now();
  explosions = explosions.filter(e => now - e.start < EXPLOSION_MS);
  for (const e of explosions) {
    const t = (now - e.start) / EXPLOSION_MS;
    const cx = (e.x + 0.5) * BLOCK;
    const cy = (e.y + 0.5) * BLOCK;
    const radius = BLOCK * 1.5 * (1 - (1 - t) * (1 - t));
    ctx.globalAlpha = 1 - t;

    // destello
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#ff7043');
    grad.addColorStop(1, 'rgba(255, 112, 67, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // chispas
    ctx.fillStyle = '#ffca28';
    for (const s of e.sparks) {
      const dist = s.speed * t * BLOCK * 2;
      ctx.fillRect(cx + Math.cos(s.angle) * dist - 1.5, cy + Math.sin(s.angle) * dist - 1.5, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    dropAccum = 0;
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    pauseControls.classList.add('hidden');
    controlsBtn.setAttribute('aria-expanded', 'false');
    startLevelSelect.value = String(startLevel);
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // lockPiece() puede terminar la partida (endGame cancela el frame): no reprogramar el bucle
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* localStorage no disponible */ }
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // El canvas no hereda del CSS: se leen los colores del tema
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  highlightColor = css.getPropertyValue('--block-highlight').trim();
  ghostAlpha = parseFloat(css.getPropertyValue('--ghost-alpha'));
  palette = isLight ? COLORS_LIGHT : COLORS;
  // Repintar: en pausa o game over no hay frames, y drawNext solo se llama en spawn()
  if (next) drawNext();
  if (current) draw();
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel; // fijo durante la partida aunque se cambie el selector
  level = gameStartLevel;
  paused = false;
  gameOver = false;
  explosions = [];
  dropInterval = levelInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (paused && e.code === 'Space') e.preventDefault(); // Space no activa botones del menú
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  togglePause();
  resumeBtn.blur();
});

pauseRestartBtn.addEventListener('click', () => {
  init();
  pauseRestartBtn.blur();
});

controlsBtn.addEventListener('click', () => {
  const open = pauseControls.classList.toggle('hidden') === false;
  controlsBtn.setAttribute('aria-expanded', String(open));
  controlsBtn.blur();
});

// Se aplica en la próxima partida (init)
startLevelSelect.addEventListener('change', () => {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, parseInt(startLevelSelect.value, 10) || 1));
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) { /* localStorage no disponible */ }
  startLevelSelect.blur();
});

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón en vez del hard drop
});

try {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (saved >= 1 && saved <= MAX_START_LEVEL) startLevel = saved;
} catch (e) { /* ignorar */ }
for (let i = 1; i <= MAX_START_LEVEL; i++) startLevelSelect.add(new Option(String(i), String(i)));
startLevelSelect.value = String(startLevel);

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
