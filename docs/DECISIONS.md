# Decisiones de diseño

Decisiones tomadas durante el desarrollo que no están especificadas en `CLAUDE.md`.

## Hito 1

- **Archivos de datos extra.** Además de los de `CLAUDE.md`, `src/data/` tiene:
  - `player.ts`: stats base de Mati (para no dejar números mágicos en `game/`).
  - `texts.ts`: textos visibles en español con `t(key)`; agregar otro idioma = agregar otro objeto.
  - `render.ts`: constantes visuales y de vista (tiles, góndolas, colores, HUD, joystick, cámara, DPR máximo).
- **Radio de colisión del jugador: 14 px.** No estaba especificado; se usará en el Hito 2.
- **Joystick flotante.** Aparece donde se toca (cualquier punto de la pantalla), radio 60 px, zona muerta 15 %.
  Es analógico (empujar poco = moverse lento). Si el joystick está activo tiene prioridad sobre el teclado.
  También responde al ratón, lo que facilita probarlo en escritorio.
- **Loop.** Timestep fijo de 1/60 s; cada frame se limita a 0.25 s para evitar la "espiral de la muerte"
  al volver de otra pestaña. El render interpola la posición del jugador con `alpha`.
- **Cámara.** Seguimiento exponencial independiente del framerate (rigidez 10/s). Es estado de vista,
  no de juego: se actualiza en `main.ts` en el paso de render, no dentro de `world`.
- **HUD dibujado en canvas**, no en el DOM (un solo sistema de coordenadas, sin layout).
- **FPS visible** en la esquina superior derecha durante el desarrollo para verificar el objetivo de rendimiento.
- **devicePixelRatio limitado a 2** para no disparar el costo de relleno en móviles 3x.
- **Góndolas decorativas.** El mundo se divide en bloques de 10×6 tiles; cada bloque tiene una góndola
  (75 % de probabilidad) con largo y posición derivados de `hash2(bloque, semilla)`. Así el mapa es infinito,
  estable y no requiere guardar nada. Sin colisión.
- **Semilla de la partida.** `Date.now()` al arrancar; se podrá fijar para reproducir bugs o para el modo diario.
- **Favicon vacío** (`data:,`) para que no haya un 404 en consola; el favicon real llega en el Hito 6.
