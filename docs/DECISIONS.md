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

## Hito 2

- **Tabla de oleadas.** Cada fila `{ minute, enemyId, spawnPerSecond, groupSize }` está activa durante
  `[minute, minute+1)`. `spawnPerSecond` son _grupos_ por segundo: "grupo de 5 cada 8 s" = `1/8` con `groupSize 5`.
  En este hito la tabla solo tiene Clientes y sube de 1/s a 3.5/s; el Hito 4 la completa.
- **Anillo de spawn.** Radio = máx(700 px, media diagonal de la pantalla + 60 px), más un grosor aleatorio de 120 px.
  El host (`main.ts`) le pasa el tamaño de la vista al mundo; los tests usan el mínimo fijo.
- **Reubicación.** Un zombi a más de 1.6× el radio del anillo vuelve a aparecer en el anillo, para que
  el mapa infinito nunca se vacíe por dejarlos atrás.
- **Escoba: alcance 75 px y empuje 220 px/s** (no estaban especificados). El arco se ensancha según el tamaño angular
  del zombi para que los roces cuenten. Golpea siempre hacia `facing`, haya o no enemigos (como el látigo de VS).
- **Daño por contacto.** Mientras dura la invulnerabilidad (0.5 s) solo entra el golpe más fuerte de los zombis que tocan,
  aunque te rodeen veinte.
- **Separación entre zombis.** Empuje suave a partir de la rejilla espacial (50 % del solapamiento por paso), solo entre zombis;
  pueden solaparse con el jugador.
- **Rejilla espacial.** Celdas de 64 px sobre una tabla hash de 4096 buckets, para que funcione en un mundo infinito.
  Cada entrada guarda su celda, así no se mezclan las celdas que comparten bucket.
- **Eventos.** `game/` emite eventos (`enemyDeath`, `playerHit`) a una cola fija; `main.ts` los vacía una vez por frame
  y los convierte en partículas. Así el render reacciona sin que la lógica toque el canvas.
- **Partículas.** Pool propio del render (800) con un RNG cosmético separado; nunca afectan la simulación.
- **Destello y empuje** al golpear y **parpadeo del jugador** mientras es invulnerable entran en este hito como parte del
  "combate base". Los números de daño y el screen shake quedan para el Hito 5.
- **Pantalla de derrota** en DOM (botón accesible y táctil): tiempo sobrevivido y bajas. La hora del turno y el nivel
  se agregan cuando existan (Hitos 3 y 4).
- **Parámetros de depuración en la URL:** `?spawn=N` (horda inicial), `?god` (sin perder vida), `?debug`.
  Con cualquiera de ellos se publican fps, CPU, enemigos y bajas en `document.body.dataset` para las pruebas automáticas.
  El HUD muestra FPS, ms de CPU y el número de zombis durante el desarrollo.
