# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris en JavaScript vanilla + HTML5 Canvas (README y UI en español). No hay build, dependencias, linter ni tests: tres archivos estáticos (`index.html`, `style.css`, `game.js`). Para ejecutar, abrir `index.html` en el navegador o servir el directorio con cualquier servidor estático (p. ej. `python -m http.server`).

## Arquitectura de `game.js`

Todo el juego vive en un único script con estado global a nivel de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.), declarado en una sola línea y asignado en `init()`.

- **Tablero**: matriz `ROWS × COLS` (20×10) de enteros. `0` = vacío; `1–7` = índice de pieza, usado tanto en `PIECES` (matrices de forma) como en `COLORS` (mismo índice). Al añadir una pieza hay que actualizar ambos arrays.
- **Pieza**: objeto `{ type, shape, x, y }`; `shape` es una matriz cuyos valores no cero son el índice de color. La rotación (`rotateCW`) genera una matriz nueva; `tryRotate` aplica *wall kicks* horizontales `[0, -1, 1, -2, 2]`.
- **Bucle**: `loop(ts)` (requestAnimationFrame) acumula `dropAccum` y baja la pieza cuando supera `dropInterval`; `dropInterval = max(100, 1000 - (level-1)*90)`, recalculado en `clearLines`. Pausa y game over cancelan el frame con `cancelAnimationFrame(animId)`; `init()` reinicia todo el estado (también lo usa el botón Reiniciar).
- **Ciclo de pieza**: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promueve `next`, genera una nueva y llama a `endGame()` si la nueva pieza colisiona al aparecer.
- **Colisión**: `collide(shape, ox, oy)` es la única función de detección; la usan movimiento, rotación, ghost (`ghostY`) y spawn.
- **Puntuación**: líneas `LINE_SCORES[n] * level`; soft drop +1 por celda, hard drop +2 por celda; nivel = `floor(lines/10)+1`.
- **Render**: `draw()` repinta todo cada frame (rejilla, tablero, pieza fantasma con alpha 0.2, pieza actual); `drawNext()` solo se llama en `spawn()`. Ambas usan `drawBlock(context, x, y, colorIndex, size, alpha)`.
- **DOM**: `game.js` depende de los IDs de `index.html` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`); el overlay se muestra/oculta con la clase `hidden`. El tamaño de los canvas (300×600 y 120×120) está en el HTML y debe coincidir con `COLS/ROWS/BLOCK`.
- **Input**: un único listener `keydown` (flechas, `X` rotar, `Space` hard drop, `P` pausa).
