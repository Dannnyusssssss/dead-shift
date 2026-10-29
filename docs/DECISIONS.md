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

## Hito 3

- **Curva de XP.** `5 + N*4 + floor(N^1.5)` es el XP para _llegar_ al nivel N (lectura literal): 15 para el 2, 22 para el 3,
  30 para el 4... El sobrante se conserva. Si una recogida da varios niveles, se encolan y las pantallas salen una tras otra.
- **Ofertas.** Se arma la lista de candidatos válidos (arma nueva si hay < 4 armas, mejora si el nivel es < 5,
  y lo mismo para los pasivos) y se sacan hasta 3 distintos con el RNG sembrado (Fisher-Yates parcial).
  Si hay menos de 3 candidatos se muestran los que haya; sin ninguno, la única opción es curar 30 %.
  Todos los candidatos pesan igual.
- **Reroll:** 1 por partida (`PROGRESSION.rerollsPerRun`); vuelve a sortear desde cero (puede repetir alguna opción).
- **Pasivos como datos** `{ stat, perLevel }`; las stats se recalculan al cambiar el equipo. Los porcentajes se _suman_
  (Café nivel 5 = ×0.60 de cooldown). El multiplicador de cooldown nunca baja de 0.2.
- **Niveles de las armas.** Los valores de los niveles 2-5 no estaban especificados; quedaron así (ajustables en `data/weapons.ts`):
  - Escoba: 14 daño → 130° y 85 px → 18 daño y cd 1.1 → ambos lados.
  - Latas: 2 latas → 12 daño → 3 latas y perfora 1 → 15 daño y perfora 2.
  - Hielo: 3 bolsas → r 85 y 8 daño → 4 bolsas más rápidas → 5 bolsas, r 100 y 10 daño.
  - Aerosol: 130 px → nube de 2 s → veneno 3/s × 2 s → 150 px, 2.5 s y 5 daño.
  - Microondas: 2 rayos → 10 s → 3 rayos y 9 daño → 2 microondas.
  - Etiquetas: cd 0.12 → 4 daño → 2 balas ±8° → 3 balas ±12°, cd 0.09 y 5 daño.
- **Comportamientos.** El cooldown del aerosol cuenta desde que termina la nube. El microondas dura 8 s y se vuelve
  a colocar 4 s después de desaparecer. Las latas no se lanzan si no hay un zombi a ≤ 600 px (esperan).
  La pistola dispara hacia `facing`. Las bolsas golpean como máximo una vez cada 0.5 s al mismo zombi
  (temporizador por enemigo y por arma). El Café afecta todos los tiempos de recarga, incluida la cadencia del microondas.
- **Cupones.** Valen el `xp` del enemigo (el Cliente da 1). Dentro del radio de recogida quedan "imantados" y siguen al jugador
  acelerando aunque se aleje. Con el pool (600) lleno, el valor se suma a un cupón existente, así no se pierde XP.
  Los botiquines y el imán como objetos del suelo no entran en este hito.
- **Muerte en su propio sistema** (`systems/death.ts`) para evitar una dependencia circular
  (muerte → cupones → progresión → jugador → armas → daño).
- **Descripciones generadas** comparando las stats de un nivel con el siguiente (`ui/describe.ts`);
  solo las armas y los pasivos nuevos tienen una frase propia.
- **Íconos con emojis** en las tarjetas y en el HUD (permitidos por CLAUDE.md). Pueden verse distintos según el sistema operativo.
- **Pantalla de mejora** en DOM: teclas 1/2/3 y R, clic o toque, foco en la primera tarjeta. Durante 250 ms después de abrirse
  se ignoran los clics, para que un toque pensado para el juego no elija una carta sin querer.
- **Depuración:** `?weapons=all` arranca con las 6 armas en nivel 5 (ignora el límite de 4 slots).

## Hito 4

- **Comportamientos como datos.** `behavior` es un objeto con sus parámetros (`{ kind: 'charge', windup: 0.6, ... }`);
  el código tiene un `switch` por `kind`. Un enemigo nuevo con un comportamiento existente solo toca `data/enemies.ts`.
  El estado de IA es genérico (`aiState`, `aiTimer`, `aiTimer2`, `aiPhase`, `aiDir`).
- **Valores no especificados** (ajustables en `data/enemies.ts`):
  - Radios: Cliente 12, Repartidor 10, Congelado 16, Carrito 15, Cajero 12, Gerente 30.
  - XP: 1 (Cliente, Repartidor), 5 (Congelado, Carrito, Cajero), 20 (Gerente).
  - Resistencia al empuje: Congelado 60 %, Carrito 30 %, Gerente 90 %.
  - Repartidor: oscilación lateral de fuerza 1.2 y 1.1 Hz.
  - Congelado: charco cada 0.8 s, radio 28, dura 4 s, −40 % de velocidad.
  - Carrito: se activa a ≤ 260 px, embiste a 380 px/s durante 0.8 s y se recupera 1 s (persiguiendo a media velocidad).
  - Cajero: distancia preferida de 260 ± 50 px, recibo cada 2.5 s a 260 px/s, explota en un radio de 45 con 8 de daño (escalado).
    Apunta a donde estabas, así que se puede esquivar.
  - Gerente: 6 Clientes cada 10 s a 70 px de él; onda cada 6 s con 0.5 s de aviso, que crece hasta 220 px en 0.6 s,
    hace 15 de daño (escalado) y golpea una sola vez.
- **Jefe 2 "más fuerte":** ×1.5 vida y ×1.25 daño, además del escalado por minuto (a los 9:00 ya es ×1.72).
  Si la arena está en el tope de 400, se elimina el zombi común más lejano para que el jefe siempre aparezca.
- **Escalado:** vida y daño × (1 + 0.08 × minutos), calculado al aparecer con el tiempo continuo, no por minuto entero.
  El factor se guarda en el enemigo, así los recibos y la onda también escalan.
- **Oleadas:** las filas admiten `offset` (segundos dentro del minuto), para el Repartidor a la 1:30, el Carrito a las 4:30
  y el enjambre final a las 9:30. Los jefes van en su propia tabla `BOSSES`.
  El Cajero entra a las 6:00 (como dice la tabla de enemigos de CLAUDE.md), no en el minuto 8 de la tabla orientativa de oleadas.
- **Cofre del jefe:** abre la pantalla de mejora con hasta 3 mejoras de armas que ya tienes (o curar si todas están en nivel 5),
  en vez de aplicar una al azar, para que la mejora "gratis" se pueda elegir. Los cofres pendientes se abren antes que los niveles.
  El cofre no se imanta: hay que caminar hasta él.
- **Reloj:** 600 s reales = de 22:00 a 06:00 (48 min de reloj por minuto real). Al amanecer el tiempo se fija en 600 exactos
  (la suma de pasos de 1/60 s queda a una fracción) y el estado pasa a `won`; la lógica se congela.
- **Amanecer:** los zombis giran, se aplastan y se desvanecen durante 1.5 s (animación solo de render). La pantalla de victoria
  aparece 1.8 s después.
- **Oscuridad:** 82 % hasta el 45 % del turno (~1:36 AM); después se aclara linealmente hasta 0 a las 6 AM, mientras la linterna
  pasa de 250 a 650 px de radio. El gradiente se cuantiza en 64 escalones y se reutiliza (sin crear objetos por frame).
  Desde el 85 % del turno se suma un tinte cálido de amanecer.
- **HUD en pantallas angostas (< 640 px):** el reloj va arriba a la derecha y la barra del jefe debajo de la columna izquierda,
  para no taparse. Las métricas de depuración pasan a la esquina inferior derecha.
- **Depuración:** `?t=SEGUNDOS` arranca el reloj adelantado (los jefes cuyo momento ya pasó no aparecen).
  Se publican también los tipos de enemigos, los peligros por tipo y los carritos apuntando.
