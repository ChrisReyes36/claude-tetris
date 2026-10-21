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

// Paletas por skin (mismos índices que COLORS). Retro usa COLORS/COLORS_LIGHT según el tema
const COLORS_NEON = [
  null,
  '#00f0ff', // I
  '#ffee00', // O
  '#d500f9', // T
  '#39ff14', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
  '#cfd8dc', // N
  '#ff4081', // bomba
];

const COLORS_PASTEL = [
  null,
  '#a8e6ef', // I
  '#fff3b0', // O
  '#d7b8f3', // T
  '#b9f0c4', // S
  '#ffb3ba', // Z
  '#b5d0ff', // J
  '#ffd6a5', // L
  '#d9d9e3', // N
  '#8d8da8', // bomba
];

const COLORS_PIXEL = [
  null,
  '#29b6f6', // I
  '#fbc02d', // O
  '#9c27b0', // T
  '#4caf50', // S
  '#e53935', // Z
  '#3f51b5', // J
  '#ef6c00', // L
  '#9e9e9e', // N
  '#37474f', // bomba
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
const MAX_START_LEVEL = 10;
const RESUME_LOCK_MS = 200;

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
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');
const skinBtns = document.querySelectorAll('.skin-btn');

let theme = 'dark';
let skin = 'retro';
let gridColor, highlightColor, ghostAlpha, palette = COLORS;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, explosions, startLevel = 1, inputLockUntil = 0;

function dropIntervalFor(lvl) {
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
    level = startLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalFor(level);
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

// Trazo del rectángulo con esquinas redondeadas (sin depender de ctx.roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// Cada skin aporta su paleta y cómo dibujar un bloque de lado s en (x, y); `glow` = shadowBlur de la bomba
const SKINS = {
  retro: {
    palette: () => (theme === 'light' ? COLORS_LIGHT : COLORS),
    block(context, x, y, s, color) {
      context.fillStyle = color;
      context.fillRect(x, y, s, s);
      context.fillStyle = highlightColor;
      context.fillRect(x, y, s, 4);
    },
  },
  neon: {
    palette: () => COLORS_NEON,
    glow: 14,
    block(context, x, y, s, color) {
      const a = context.globalAlpha;
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillStyle = color;
      context.globalAlpha = a * 0.3;
      context.fillRect(x, y, s, s);
      context.globalAlpha = a;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, s - 2, s - 2);
      context.shadowBlur = 0;
    },
  },
  pastel: {
    palette: () => COLORS_PASTEL,
    block(context, x, y, s, color) {
      context.fillStyle = color;
      roundedRectPath(context, x, y, s, s, 8);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.55)';
      roundedRectPath(context, x + 4, y + 3, s - 8, 5, 2.5);
      context.fill();
    },
  },
  pixel: {
    palette: () => COLORS_PIXEL,
    block(context, x, y, s, color) {
      const u = Math.max(2, Math.round(s / 6)); // tamaño del "píxel"
      context.fillStyle = color;
      context.fillRect(x, y, s, s);
      // bordes de luz/sombra
      context.fillStyle = 'rgba(255, 255, 255, 0.35)';
      context.fillRect(x, y, s, u);
      context.fillRect(x, y, u, s);
      context.fillStyle = 'rgba(0, 0, 0, 0.3)';
      context.fillRect(x, y + s - u, s, u);
      context.fillRect(x + s - u, y, u, s);
      // textura: damero de píxeles en el interior
      context.fillStyle = 'rgba(0, 0, 0, 0.12)';
      const n = Math.floor((s - 2 * u) / u);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if ((i + j) % 2 === 0) context.fillRect(x + u + i * u, y + u + j * u, u, u);
    },
  },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = palette[colorIndex];
  const sk = SKINS[skin];
  context.globalAlpha = alpha ?? 1;
  if (colorIndex === BOMB) {
    const cx = x * size + size / 2;
    const cy = y * size + size / 2 + 2;
    const rad = size / 2 - 4;
    if (sk.glow) {
      context.shadowColor = color;
      context.shadowBlur = sk.glow;
    }
    context.fillStyle = color;
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
    context.shadowBlur = 0;
    context.globalAlpha = 1;
    return;
  }
  sk.block(context, x * size + 1, y * size + 1, size - 2, color);
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

function showPauseView(controls) {
  pauseMain.classList.toggle('hidden', controls);
  pauseControls.classList.toggle('hidden', !controls);
  (controls ? controlsBackBtn : resumeBtn).focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    // Evita que Space/flechas usados en el menú disparen una acción en el juego al volver
    document.activeElement?.blur();
    inputLockUntil = performance.now() + RESUME_LOCK_MS;
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
    showPauseView(false);
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

// Sincroniza DOM, colores del canvas y paleta con `theme` y `skin`, y repinta
function refreshLook() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.skin = skin;
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // Las skins distintas de Retro traen su propio fondo: el tema claro/oscuro solo aplica a Retro
  themeBtn.disabled = skin !== 'retro';
  themeBtn.title = themeBtn.disabled ? 'Solo disponible en la skin Retro' : '';
  skinBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skin === skin)));
  // El canvas no hereda del CSS: se leen los colores del tema/skin
  const css = getComputedStyle(document.documentElement);
  gridColor = css.getPropertyValue('--grid').trim();
  highlightColor = css.getPropertyValue('--block-highlight').trim();
  ghostAlpha = parseFloat(css.getPropertyValue('--ghost-alpha'));
  palette = SKINS[skin].palette();
  // Repintar: en pausa o game over no hay frames, y drawNext solo se llama en spawn()
  if (next) drawNext();
  if (current) draw();
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* localStorage no disponible */ }
  refreshLook();
}

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  try { localStorage.setItem(SKIN_KEY, skin); } catch (e) { /* localStorage no disponible */ }
  refreshLook();
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  explosions = [];
  dropInterval = dropIntervalFor(level);
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
    // En la vista de controles, Esc vuelve al menú en vez de reanudar
    if (paused && e.code === 'Escape' && !pauseControls.classList.contains('hidden')) {
      showPauseView(false);
    } else {
      togglePause();
    }
    return;
  }
  // Con el menú abierto el teclado es solo del menú (botones y selector)
  if (paused || gameOver) return;
  if (performance.now() < inputLockUntil) {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
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

restartBtn.addEventListener('click', init);

for (let i = 1; i <= MAX_START_LEVEL; i++) startLevelSelect.add(new Option(i, i));
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  document.activeElement?.blur();
  init();
});
controlsBtn.addEventListener('click', () => showPauseView(true));
controlsBackBtn.addEventListener('click', () => showPauseView(false));

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Space active el botón en vez del hard drop
});

skinBtns.forEach(b => b.addEventListener('click', () => {
  applySkin(b.dataset.skin);
  b.blur(); // evita que Space active el botón en vez del hard drop
}));

let savedTheme = null, savedSkin = null;
try {
  savedTheme = localStorage.getItem(THEME_KEY);
  savedSkin = localStorage.getItem(SKIN_KEY);
} catch (e) { /* ignorar */ }
theme = savedTheme === 'light' ? 'light' : 'dark';
skin = SKINS[savedSkin] ? savedSkin : 'retro';
refreshLook();

init();
