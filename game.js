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
const SKIN_KEY = 'tetris-skin';

// Neon: colores muy saturados (misma paleta en tema claro y oscuro; el fondo del canvas es negro)
const COLORS_NEON = [
  null,
  '#00e5ff', // I
  '#ffea00', // O
  '#d500f9', // T
  '#00e676', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
  '#cfd8dc', // N
  '#f5f5f5', // bomba
];

const COLORS_PASTEL = [
  null,
  '#a8e6ef', // I
  '#fff1b8', // O
  '#d9b8f0', // T
  '#b9e8c1', // S
  '#f7b9b9', // Z
  '#b8d4f5', // J
  '#fbd3a8', // L
  '#d5dde2', // N
  '#a7a9bd', // bomba
];

const COLORS_PASTEL_LIGHT = [
  null,
  '#7fd3df', // I
  '#f5d56a', // O
  '#c093e0', // T
  '#8fd29c', // S
  '#ef9a9a', // Z
  '#8fb8ec', // J
  '#f5b878', // L
  '#b4c1c9', // N
  '#7b7d96', // bomba
];

const COLORS_PIXEL = [
  null,
  '#29b6f6', // I
  '#fdd835', // O
  '#ab47bc', // T
  '#66bb6a', // S
  '#ef5350', // Z
  '#5c6bc0', // J
  '#ff9800', // L
  '#90a4ae', // N
  '#37474f', // bomba
];

const COLORS_PIXEL_LIGHT = [
  null,
  '#0288d1', // I
  '#f9a800', // O
  '#8e24aa', // T
  '#388e3c', // S
  '#d32f2f', // Z
  '#3949ab', // J
  '#ef6c00', // L
  '#607d8b', // N
  '#263238', // bomba
];

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
const skinSelect = document.getElementById('skin-select');

let theme = 'dark';
let skinName = 'retro';
let gridColor, highlightColor, ghostAlpha, palette = COLORS;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, explosions;

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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

// Rectángulo redondeado con fallback a arcTo si no existe roundRect
function roundedRect(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Cada skin dibuja un bloque en (px, py) píxeles; el color ya viene resuelto de la paleta
function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = highlightColor;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  // El resplandor (shadowBlur) lo fija drawBlock y lo resetea después
  const a = context.globalAlpha;
  context.fillStyle = color;
  context.globalAlpha = a * 0.25;
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.globalAlpha = a;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
}

function drawPastelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  roundedRect(context, px + 2, py + 2, size - 4, size - 4, size * 0.28);
  context.fill();
  context.fillStyle = 'rgba(255, 255, 255, 0.4)';
  roundedRect(context, px + 5, py + 5, size - 10, 4, 2);
  context.fill();
}

// Textura fija 4x4 por tipo de color: no depende de la posición, así no parpadea ni se mueve
function pixelShade(i, j, k) {
  return (((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) >>> 0) % 3;
}

function drawPixelBlock(context, px, py, size, color, colorIndex) {
  const inner = size - 2;
  const n = 4;
  const cell = inner / n;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, inner, inner);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const shade = pixelShade(i, j, colorIndex);
      if (shade === 0) continue;
      context.fillStyle = shade === 1 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)';
      context.fillRect(px + 1 + i * cell, py + 1 + j * cell, cell, cell);
    }
  }
  context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, size - 4, size - 4);
}

const SKINS = {
  retro: { colors: COLORS, colorsLight: COLORS_LIGHT, drawBlock: drawRetroBlock, fuse: '#ff7043' },
  neon: { colors: COLORS_NEON, colorsLight: COLORS_NEON, drawBlock: drawNeonBlock, fuse: '#ff1744', glow: true },
  pastel: { colors: COLORS_PASTEL, colorsLight: COLORS_PASTEL_LIGHT, drawBlock: drawPastelBlock, fuse: '#ffab91' },
  pixel: { colors: COLORS_PIXEL, colorsLight: COLORS_PIXEL_LIGHT, drawBlock: drawPixelBlock, fuse: '#ff7043' },
};

function drawBomb(context, x, y, size, color, skin) {
  const cx = x * size + size / 2;
  const cy = y * size + size / 2 + 2;
  const rad = size / 2 - 4;
  context.fillStyle = color;
  context.beginPath();
  context.arc(cx, cy, rad, 0, Math.PI * 2);
  context.fill();
  // mecha
  context.strokeStyle = skin.fuse;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(cx, cy - rad);
  context.lineTo(cx + 4, cy - rad - 4);
  context.stroke();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[skinName];
  const color = palette[colorIndex];
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowColor = color;
    context.shadowBlur = size * 0.5;
  }
  if (colorIndex === BOMB) drawBomb(context, x, y, size, color, skin);
  else skin.drawBlock(context, x * size, y * size, size, color, colorIndex);
  // No contaminar rejilla ni explosiones
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
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
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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

// El canvas no hereda del CSS: se leen sus colores y se elige la paleta según skin + tema
function refreshStyle() {
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  highlightColor = css.getPropertyValue('--block-highlight').trim();
  ghostAlpha = parseFloat(css.getPropertyValue('--ghost-alpha'));
  const skin = SKINS[skinName];
  palette = theme === 'light' ? skin.colorsLight : skin.colors;
  // Repintar: en pausa o game over no hay frames, y drawNext solo se llama en spawn()
  if (next) drawNext();
  if (current) draw();
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* localStorage no disponible */ }
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  refreshStyle();
}

function applySkin(name) {
  skinName = Object.hasOwn(SKINS, name) ? name : 'retro';
  document.documentElement.dataset.skin = skinName;
  try { localStorage.setItem(SKIN_KEY, skinName); } catch (e) { /* localStorage no disponible */ }
  skinSelect.value = skinName;
  refreshStyle();
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  explosions = [];
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el select abierto usa flechas/Space para navegar
  if (e.code === 'KeyP') { togglePause(); return; }
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

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón en vez del hard drop
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Space/flechas cambien la opción en vez de jugar
});

let savedTheme = null, savedSkin = null;
try {
  savedTheme = localStorage.getItem(THEME_KEY);
  savedSkin = localStorage.getItem(SKIN_KEY);
} catch (e) { /* ignorar */ }
applySkin(savedSkin);
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

init();
