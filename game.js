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

// Neón: tonos fluorescentes (el fondo siempre es negro, una sola paleta)
const COLORS_NEON = [
  null,
  '#00f0ff', // I
  '#fff200', // O
  '#ff00ff', // T
  '#39ff14', // S
  '#ff073a', // Z
  '#4d7cff', // J
  '#ff9900', // L
  '#c0c0ff', // N
  '#ff3131', // bomba
];

// Pastel: tonos suaves (mismos índices que COLORS)
const COLORS_PASTEL = [
  null,
  '#a8e6ef', // I
  '#fff3b0', // O
  '#d7b9f0', // T
  '#b9f0c4', // S
  '#f7b7b7', // Z
  '#bcd7ff', // J
  '#ffd6a5', // L
  '#d5dbe0', // N
  '#6d6875', // bomba
];

// Pastel algo más saturado para fondo claro
const COLORS_PASTEL_LIGHT = [
  null,
  '#7fd3e0', // I
  '#ffe066', // O
  '#c39bea', // T
  '#8fe0a3', // S
  '#f29b9b', // Z
  '#93bcf5', // J
  '#ffbf80', // L
  '#b4bdc6', // N
  '#4a4453', // bomba
];

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const SKIN_KEY = 'tetris-skin';

// Cada skin aporta paleta oscura/clara y la función que dibuja un bloque normal
const SKINS = {
  retro:  { colors: COLORS,        colorsLight: COLORS_LIGHT,        cell: drawCellRetro },
  neon:   { colors: COLORS_NEON,   colorsLight: COLORS_NEON,         cell: drawCellNeon, glow: true },
  pastel: { colors: COLORS_PASTEL, colorsLight: COLORS_PASTEL_LIGHT, cell: drawCellPastel },
  pixel:  { colors: COLORS,        colorsLight: COLORS_LIGHT,        cell: drawCellPixel },
};

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
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');
const nameForm = document.getElementById('name-form');
const nameFormMsg = document.getElementById('name-form-msg');
const nameInput = document.getElementById('player-name');
const recordsList = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetRecordsBtn = document.getElementById('reset-records');
const skinBtns = document.querySelectorAll('.skin-btn');

// Teclas pulsadas mientras el menú estaba abierto: se ignoran hasta que se suelten
const heldKeys = new Set();
let startLevel = 1;
let theme = 'dark';
let skinName = 'retro', skin = SKINS.retro;
let gridColor, highlightColor, ghostAlpha, palette = COLORS;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, explosions;
let started = false, combo = 0, maxCombo = 0, records = { top: [], bestCombo: 0, bestLines: 0 };

function loadRecords() {
  const empty = { top: [], bestCombo: 0, bestLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.top)) return empty;
    const top = data.top
      .filter(e => e && Number.isFinite(e.score))
      .map(e => ({
        name: String(e.name ?? '').slice(0, NAME_MAX) || 'Anónimo',
        score: e.score,
        lines: Number.isFinite(e.lines) ? e.lines : 0,
        combo: Number.isFinite(e.combo) ? e.combo : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return {
      top,
      bestCombo: Number.isFinite(data.bestCombo) ? data.bestCombo : 0,
      bestLines: Number.isFinite(data.bestLines) ? data.bestLines : 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) { /* localStorage no disponible */ }
}

// Posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra
function recordRank(s) {
  if (s <= 0) return -1;
  const i = records.top.findIndex(e => e.score < s);
  if (i !== -1) return i;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

function insertRecord(name) {
  const rank = recordRank(score);
  if (rank === -1) return -1;
  records.top.splice(rank, 0, { name, score, lines, combo: maxCombo });
  records.top.length = Math.min(records.top.length, MAX_RECORDS);
  saveRecords();
  return rank;
}

function renderRecords(highlightIdx = -1) {
  recordsList.textContent = '';
  for (let i = 0; i < MAX_RECORDS; i++) {
    const e = records.top[i];
    const li = document.createElement('li');
    const name = document.createElement('span');
    const pts = document.createElement('span');
    name.textContent = e ? e.name : '---';
    pts.textContent = e ? e.score.toLocaleString() : '';
    li.append(name, pts);
    if (!e) li.classList.add('empty');
    if (i === highlightIdx) li.classList.add('highlight');
    recordsList.appendChild(li);
  }
  bestComboEl.textContent = records.bestCombo;
  bestLinesEl.textContent = records.bestLines;
}

function intervalFor(lvl) {
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
  // Combo: bloqueos consecutivos que limpian líneas (solo se registra, no da puntos)
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
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
  scoreEl.classList.toggle('record', recordRank(score) !== -1);
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
    if (skin.glow) {
      context.shadowBlur = 12;
      context.shadowColor = color;
    }
    context.beginPath();
    context.arc(cx, cy, rad, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
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
  skin.cell(context, x * size, y * size, size, color);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

// Las funciones de celda parten de globalAlpha ya fijado y fillStyle = color
function drawCellRetro(context, px, py, size, color) {
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = highlightColor;
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawCellNeon(context, px, py, size, color) {
  const baseAlpha = context.globalAlpha;
  context.shadowBlur = 12;
  context.shadowColor = color;
  // relleno translúcido + borde brillante
  context.globalAlpha = baseAlpha * 0.25;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.globalAlpha = baseAlpha;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, size - 4, size - 4);
  // núcleo interior
  context.fillRect(px + size * 0.35, py + size * 0.35, size * 0.3, size * 0.3);
  context.shadowBlur = 0;
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawCellPastel(context, px, py, size, color) {
  const r = size / 5;
  roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
  context.fill();
  // brillo suave en la mitad superior
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  roundRectPath(context, px + 3.5, py + 3.5, size - 7, (size - 7) / 2, r / 2);
  context.fill();
  // borde sutil
  roundRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
  context.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  context.lineWidth = 1;
  context.stroke();
}

// Textura de "píxeles" con overlays alpha, válida para cualquier color
function drawCellPixel(context, px, py, size, color) {
  const p = size / 6;
  const n = 6;
  context.fillRect(px, py, size, size);
  // tablero de ajedrez interior
  context.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let r = 1; r < n - 1; r++)
    for (let c = 1; c < n - 1; c++)
      if ((r + c) % 2 === 0) context.fillRect(px + c * p, py + r * p, p, p);
  // luz arriba/izquierda
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.fillRect(px, py, size, p);
  context.fillRect(px, py + p, p, size - p);
  // sombra abajo/derecha
  context.fillStyle = 'rgba(0, 0, 0, 0.3)';
  context.fillRect(px + p, py + size - p, size - p, p);
  context.fillRect(px + size - p, py + p, p, size - 2 * p);
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
  overlayScore.textContent =
    `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}`;
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.bestLines = Math.max(records.bestLines, lines);
  saveRecords();
  const rank = recordRank(score);
  renderRecords();
  if (rank !== -1) {
    nameFormMsg.textContent = `¡Nuevo récord! Puesto #${rank + 1}`;
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    nameInput.focus();
  }
  restartBtn.textContent = 'Reiniciar';
  overlay.classList.remove('hidden');
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  pauseControls.classList.add('hidden');
  controlsBtn.setAttribute('aria-expanded', 'false');
  startLevelSelect.value = startLevel;
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus();
}

function resume() {
  pauseMenu.classList.add('hidden');
  // evita que Space/Enter vuelvan a activar el botón con foco en vez del hard drop
  document.activeElement.blur();
  paused = false;
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (!started || gameOver) return;
  if (paused) resume();
  else openPauseMenu();
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
  refreshCanvasStyle();
}

function applySkin(name) {
  skinName = SKINS[name] ? name : 'retro';
  skin = SKINS[skinName];
  document.documentElement.dataset.skin = skinName;
  try { localStorage.setItem(SKIN_KEY, skinName); } catch (e) { /* localStorage no disponible */ }
  skinBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skin === skinName)));
  refreshCanvasStyle();
}

// Miniatura de cada skin con su propia función de celda y la paleta del tema actual
function drawSkinPreviews() {
  skinBtns.forEach(btn => {
    const s = SKINS[btn.dataset.skin];
    const pctx = btn.querySelector('canvas').getContext('2d');
    pctx.clearRect(0, 0, 36, 36);
    pctx.globalAlpha = 1;
    const color = (theme === 'light' ? s.colorsLight : s.colors)[3];
    pctx.fillStyle = color;
    s.cell(pctx, 3, 3, 30, color);
    pctx.shadowBlur = 0;
  });
}

// El canvas no hereda del CSS: se leen los colores del tema/skin y se repinta
function refreshCanvasStyle() {
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  highlightColor = css.getPropertyValue('--block-highlight').trim();
  ghostAlpha = parseFloat(css.getPropertyValue('--ghost-alpha'));
  palette = theme === 'light' ? skin.colorsLight : skin.colors;
  drawSkinPreviews();
  // Repintar: en pausa o game over no hay frames, y drawNext solo se llama en spawn()
  if (next) drawNext();
  if (current) draw();
  else if (!started) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid(); } // pantalla de inicio
}

function init() {
  board = createBoard();
  started = true;
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  nameForm.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  paused = false;
  gameOver = false;
  explosions = [];
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribir el nombre no debe mover/pausar
  if (!started) return;
  if (e.code === 'KeyP' || (e.code === 'Escape' && !gameOver)) {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  if (paused || gameOver) {
    heldKeys.add(e.code);
    return;
  }
  // tecla mantenida desde que el menú estaba abierto: ignorar hasta que se suelte
  if (heldKeys.has(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    return;
  }
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

document.addEventListener('keyup', e => heldKeys.delete(e.code));

restartBtn.addEventListener('click', init);
pauseRestartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resume);

controlsBtn.addEventListener('click', () => {
  const open = pauseControls.classList.toggle('hidden') === false;
  controlsBtn.setAttribute('aria-expanded', String(open));
});

// Solo afecta a la próxima partida (Reiniciar o game over), no a la en curso
startLevelSelect.addEventListener('change', () => {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, parseInt(startLevelSelect.value, 10) || 1));
  try { localStorage.setItem(START_LEVEL_KEY, String(startLevel)); } catch (e) { /* localStorage no disponible */ }
});

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón en vez del hard drop
});

skinBtns.forEach(btn => btn.addEventListener('click', () => {
  applySkin(btn.dataset.skin);
  btn.blur(); // evita que Space active el botón en vez del hard drop
}));

let savedTheme = null, savedSkin = null;
try {
  savedTheme = localStorage.getItem(THEME_KEY);
  savedSkin = localStorage.getItem(SKIN_KEY);
} catch (e) { /* ignorar */ }
applySkin(savedSkin);
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

try { startLevel = parseInt(localStorage.getItem(START_LEVEL_KEY), 10); } catch (e) { /* ignorar */ }
startLevel = Math.min(MAX_START_LEVEL, Math.max(1, startLevel || 1));
startLevelSelect.value = startLevel;

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (nameForm.classList.contains('hidden')) return;
  const idx = insertRecord(nameInput.value.trim().slice(0, NAME_MAX) || 'Anónimo');
  nameForm.classList.add('hidden');
  renderRecords(idx);
});

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records?')) return;
  records = { top: [], bestCombo: 0, bestLines: 0 };
  saveRecords();
  nameForm.classList.add('hidden'); // el récord pendiente ya no existe
  renderRecords();
  if (gameOver) overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}`;
});

// Pantalla de inicio: tablero vacío + records; el juego empieza con "Jugar"
function showStart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  renderRecords();
  overlay.classList.remove('hidden');
}

records = loadRecords();
showStart();
