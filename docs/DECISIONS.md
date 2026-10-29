# Decisiones de diseño

Decisiones tomadas durante el desarrollo que no están especificadas en `CLAUDE.md`.

## Hito 1

- **Archivos de datos extra.** Además de los de `CLAUDE.md`, `src/data/` tiene:
  - `player.ts`: stats base de Mati (para no dejar números mágicos en `game/`).
  - `texts.ts`: textos visibles en español con `t(key)`; agregar otro idioma = agregar otro objeto.
  - `render.ts`: constantes visuales y de vista (tiles, góndolas, colores, HUD, joystick, cámara, DPR máximo).
- **Radio de colisión del jugador: 14 px.** No estaba especificado; se usará en el Hito 2.
- ~~**Joystick flotante.** Aparece donde se toca (cualquier punto de la pantalla), radio 60 px, zona muerta 15 %.
  Es analógico (empujar poco = moverse lento). Si el joystick está activo tiene prioridad sobre el teclado.
  También responde al ratón, lo que facilita probarlo en escritorio.~~
  **Reemplazada en Hito 4.5:** el joystick de movimiento solo aparece en la mitad izquierda; la mitad derecha
  es el joystick de apuntado y el ratón apunta y dispara (ya no mueve). Radio, zona muerta y analógico se mantienen.
- **Loop.** Timestep fijo de 1/60 s; cada frame se limita a 0.25 s para evitar la "espiral de la muerte"
  al volver de otra pestaña. El render interpola la posición del jugador con `alpha`.
- **Cámara.** Seguimiento exponencial independiente del framerate (rigidez 10/s). Es estado de vista,
  no de juego: se actualiza en `main.ts` en el paso de render, no dentro de `world`.
- **HUD dibujado en canvas**, no en el DOM (un solo sistema de coordenadas, sin layout).
- ~~**FPS visible** en la esquina superior derecha durante el desarrollo para verificar el objetivo de rendimiento.~~
  ~~**Reemplazada en Hito 5:** la línea de FPS / CPU / zombis solo aparece con los parámetros de depuración.~~
  **Reemplazada en Hito 7:** se muestra con F3, con la casilla de la pausa (se guarda) o con los parámetros de depuración.
- **devicePixelRatio limitado a 2** para no disparar el costo de relleno en móviles 3x.
- **Góndolas** derivadas de `hash2(bloque, semilla)`: el mundo se divide en bloques de 10×6 tiles y cada uno tiene una
  góndola (75 % de probabilidad) con largo y posición derivados del hash. Así el mapa es infinito, estable y no requiere
  guardar nada. ~~Decorativas, sin colisión.~~ **Reemplazada en Hito 8:** son sólidas (ver allí).
- **Semilla de la partida.** `Date.now()` al arrancar; se podrá fijar para reproducir bugs o para el modo diario.
- ~~**Favicon vacío** (`data:,`) para que no haya un 404 en consola; el favicon real llega en el Hito 6.~~
  **Reemplazada en Hito 6:** favicon SVG en `public/favicon.svg`.

## Hito 2

- **Tabla de oleadas.** Cada fila `{ minute, enemyId, spawnPerSecond, groupSize }` está activa durante
  `[minute, minute+1)`. `spawnPerSecond` son _grupos_ por segundo: "grupo de 5 cada 8 s" = `1/8` con `groupSize 5`.
  En este hito la tabla solo tiene Clientes y sube de 1/s a 3.5/s; el Hito 4 la completa.
- **Anillo de spawn.** Radio = máx(700 px, media diagonal de la pantalla + 60 px), más un grosor aleatorio de 120 px.
  El host (`main.ts`) le pasa el tamaño de la vista al mundo; los tests usan el mínimo fijo.
- **Reubicación.** Un zombi a más de 1.6× el radio del anillo vuelve a aparecer en el anillo, para que
  el mapa infinito nunca se vacíe por dejarlos atrás.
- ~~**Escoba: alcance 75 px y empuje 220 px/s** (no estaban especificados). El arco se ensancha según el tamaño angular
  del zombi para que los roces cuenten. Golpea siempre hacia `facing`, haya o no enemigos (como el látigo de VS).~~
  **Reemplazada en Hito 4.5:** la Escoba es manual: golpea hacia la mira solo con el gatillo, con sus propios valores
  (ver Hito 4.5). Se mantiene que el arco se ensancha según el tamaño angular del zombi.
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
  ~~El HUD muestra FPS, ms de CPU y el número de zombis durante el desarrollo.~~ **Reemplazada en Hito 7** (F3 y casilla).

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
  - ~~Escoba: 14 daño → 130° y 85 px → 18 daño y cd 1.1 → ambos lados.~~ **Reemplazada en Hito 4.5** (Escoba manual).
  - Latas: 2 latas → 12 daño → 3 latas y perfora 1 → 15 daño y perfora 2.
  - Hielo: 3 bolsas → r 85 y 8 daño → 4 bolsas más rápidas → 5 bolsas, r 100 y 10 daño.
  - Aerosol: 130 px → nube de 2 s → veneno 3/s × 2 s → 150 px, 2.5 s y 5 daño.
  - Microondas: 2 rayos → 10 s → 3 rayos y 9 daño → 2 microondas.
  - ~~Etiquetas: cd 0.12 → 4 daño → 2 balas ±8° → 3 balas ±12°, cd 0.09 y 5 daño.~~ **Reemplazada en Hito 4.5**
    (Pistola manual con munición).
- **Comportamientos.** El cooldown del aerosol cuenta desde que termina la nube. El microondas dura 8 s y se vuelve
  a colocar 4 s después de desaparecer. Las latas no se lanzan si no hay un zombi a ≤ 600 px (esperan).
  ~~La pistola dispara hacia `facing`.~~ (**Reemplazada en Hito 4.5:** dispara hacia la mira, con el gatillo.) Las bolsas golpean como máximo una vez cada 0.5 s al mismo zombi
  (temporizador por enemigo y por arma). El Café afecta todos los tiempos de recarga, incluida la cadencia del microondas.
- **Cupones.** Valen el `xp` del enemigo (el Cliente da 1). Dentro del radio de recogida quedan "imantados" y siguen al jugador
  acelerando aunque se aleje. Con el pool (600) lleno, el valor se suma a un cupón existente, así no se pierde XP.
  ~~Los botiquines y el imán como objetos del suelo no entran en este hito.~~ **Reemplazada en Hito 7:** ya existen.
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

## Hito 4.5

- **Dos armas manuales fuera de los slots.** La Pistola de etiquetas (`behavior: 'gun'`) y la Escoba (`behavior: 'melee'`)
  viven en `player.manual`, no en `player.weapons`. El tope de 4 armas cuenta solo las automáticas, así que entran las cuatro
  (latas, hielo, aerosol, microondas). Las manuales se mejoran del 1 al 5 con las ofertas de nivel (y con el cofre del jefe),
  pero nunca aparecen como "arma nueva". **Reemplaza** "empieza con la Escoba" (CLAUDE.md §5.2): Mati arranca con pistola
  y escoba manuales y sin armas automáticas.
- **Mira = dirección del personaje.** Con mouse o joystick de apuntado, `facing` sigue a la mira: Mati gira hacia ella y
  el aerosol y el microondas también apuntan con el mouse. **Reemplaza** "el jugador mira hacia donde se mueve" (CLAUDE.md §5.2).
  Sin mouse ni joystick de apuntado (solo teclado), la mira sigue al movimiento y Espacio dispara.
- **Controles:**
  - Escritorio: WASD/flechas para moverse, mouse para apuntar, clic mantenido (o Espacio) para disparar o golpear,
    R para recargar, Q o la rueda para cambiar de arma (la rueda espera 200 ms entre cambios por los trackpads).
  - Táctil: la mitad izquierda es el joystick de movimiento y la mitad derecha el de apuntado, que dispara mientras está empujado.
    Un botón "Cambiar arma" aparece con el primer toque. ~~No hay botón de recarga: es automática al vaciar el cargador.~~
    **Reemplazada en Hito 5:** hay botón "Recargar" (ver Hito 5); la recarga automática al vaciar se mantiene.
  - Las pulsaciones de una vez (Q, R, rueda, botón) se descartan mientras hay un menú abierto, para que la R del reroll
    no dispare una recarga.
  - El canvas oculta el cursor y dibuja una mira.
- **Munición.** El cargador arranca lleno, con 60 balas de reserva y un tope de 120.
  - **Recarga:** con R o sola al vaciarse el cargador. Pasa `min(falta, reserva)`. No se puede disparar mientras dura,
    y cambiar de arma la cancela.
  - **Cambio automático:** con cargador y reserva en 0 se pasa a la Escoba (`autoSwitched`). Al recoger munición se vuelve
    a la pistola y recarga, **solo si** la Escoba estaba puesta por ese cambio automático. Si el jugador eligió la Escoba con Q,
    se respeta.
  - No se puede cambiar a la pistola con 0/0.
  - El Café acelera la cadencia y el golpe, no la recarga. La Calculadora afecta a las dos armas manuales.
- **Valores** (todos en `data/weapons.ts`). ~~Columna Escoba~~ **reemplazada en Hito 7** (Escoba más débil):

  | Nivel | Pistola                                              | Escoba                              |
  | ----- | ---------------------------------------------------- | ----------------------------------- |
  | 1     | 10 daño, cadencia 0.18 s, cargador 12, recarga 1.3 s | 12 daño, cd 0.5 s, arco 110°, 75 px |
  | 2     | 12 daño                                              | 16 daño                             |
  | 3     | cargador 18, recarga 1.1 s                           | 140°, 85 px                         |
  | 4     | perfora 1, cadencia 0.15 s                           | 20 daño, cd 0.42 s                  |
  | 5     | 2 balas ±6°, 14 daño                                 | ambos lados                         |

- **Cajas de munición:** 15 balas cada una. Probabilidad de caída según el XP del enemigo:
  - ~~18 %~~ 22 % los comunes (xp 1) (**cambiado en Hito 7**).
  - 50 % los élite (xp 5).
  - 100 % el Gerente.

  El sorteo usa el RNG sembrado (determinista), las cajas se imantan como los cupones y el pool es de 40.

- **Balance (prueba con bot, `BALANCE=1 npx vitest run tests/balance.test.ts`).** Con los primeros valores (9 de daño, 10 % de caída)
  el bot quedaba sin munición entre el 20 y el 50 % del tiempo: 3 balas por Cliente contra 1.5 balas ganadas por baja.
  Con 10 de daño (2 balas por Cliente) y 18 % / 50 % de caída, pasa sin munición solo entre el 0 y el 15 % del tiempo,
  con una reserva promedio de ~20 balas. El bot (esquiva la horda, prioriza armas) sobrevive entre 3.4 y 4.3 min.
  Como referencia, el mismo tipo de bot en el Hito 4 (Escoba automática hacia `facing`) moría en menos de 75 s.
  La dificultad general (vida de los zombis, densidad) no se tocó; queda para ajustar con partidas reales.
- **HUD:**
  - Panel abajo a la izquierda con el arma activa y su nivel, `cargador / reserva` (amarillo con ≤ 25 %),
    barra de "Recargando", "SIN MUNICIÓN" en rojo, y la munición entre paréntesis si se eligió la Escoba con balas.
  - Las armas automáticas muestran una sombra que baja con su cooldown.
- **Depuración:** `?ammo=N` arranca con el cargador vacío y N balas de reserva (con `?ammo=0` arranca directo en la Escoba).
  `?weapons=all` deja las 4 automáticas y las 2 manuales en nivel 5, con la reserva llena.
  El dataset suma `active`, `ammo`, `reloading`, `ammoBoxes` y `manualLevels`.

## Hito 5

- **Eventos para el feedback.** La lógica emite eventos nuevos (`gunFire`, `reloadStart`, `reloadDone`, `dryFire`,
  `weaponSwap`, `ammoPickup`, `couponPickup`, `meleeSwing`, `canThrow`, `levelUp`, `chestOpen`, `bossSpawn`,
  `bossDeath`, `shockwave`) a la misma cola de siempre; `main.ts` los traduce en sonido, partículas y shake con una
  tabla `evento → sonido`. Victoria y derrota no son eventos: el host ya ve el cambio de `status`.
  - **Cargador vacío** (`dryFire`): suena al disparar la última bala y cada vez que se aprieta el gatillo (flanco)
    mientras se recarga.
  - Subir de nivel suena una sola vez aunque haya varios niveles encolados.
- **Números de daño en una cola aparte** (`world.hits`, 512). Así una lluvia de golpes del aerosol nunca desplaza
  un evento importante. Las armas usan `hitEnemy` (= `damageEnemy` + número); `damageEnemy` queda pura.
  - El **veneno no muestra números** (se descuenta por paso, en fracciones).
  - Se muestra el daño redondeado (mínimo 1). Desde 20 de daño el número es más grande y amarillo.
  - Pool de 150 en el render y caché de strings por valor. Se dibujan **encima de la oscuridad** para que se lean de noche.
- **Golpe a zombi:** un solo sonido por frame si hubo algún golpe, con un intervalo mínimo de 50 ms.
- **Audio.** Cada sonido es un dato en `data/audio.ts` (capas de oscilador o ruido filtrado con barrido de frecuencia);
  los jingles son capas con `delay`. Hay un intervalo mínimo por sonido y un tope de 28 voces simultáneas.
  - El `AudioContext` se crea en el primer gesto real (`navigator.userActivation`). En táctil eso es al soltar el dedo,
    no al apoyarlo, así que se escucha `pointerdown`, `pointerup`, `touchend`, `keydown` y `click`.
  - El ruido blanco usa `Math.random`: es cosmético y nunca toca la simulación.
- **Screen shake** por "trauma" (0..1) en la cámara; el desplazamiento es `16 px × trauma²` con senos desfasados y
  decae 1.3/s. Valores en `SHAKE` (`data/render.ts`):

  | Evento               | Trauma |
  | -------------------- | ------ |
  | Golpe recibido       | 0.32   |
  | Explosión a ≤ 260 px | 0.25   |
  | Aparece el jefe      | 0.75   |
  | Onda del jefe        | 0.6    |
  | Muere el jefe        | 0.9    |

  El desplazamiento se suma solo al dibujar: el apuntado sigue usando la cámara sin temblor.

- **Destello de daño:** viñeta roja en los bordes durante 0.35 s (gradiente cacheado por tamaño de vista).
- **Menú principal** en DOM. El mundo queda congelado detrás hasta pulsar Jugar. Con cualquier parámetro de
  depuración se salta el menú y la partida empieza directo (para las pruebas automáticas).
- **Pausa** con Esc / P, botón en pantalla (arriba a la derecha, táctil y mouse), `blur` y `visibilitychange`.
  - Es estado del host (`main.ts` no llama a `updateWorld`), no un `WorldStatus`.
  - Durante la pausa se congelan también las partículas, los números y el shake.
  - No se abre en la pantalla de mejora ni en las de fin.
  - Panel: Continuar, Sonido, Salir al menú.
- **Silencio:** tecla M en cualquier momento y botón en el menú principal y en la pausa. Se guarda al cambiarlo.
- **Guardado** (`deadshift:v1`): `{ bestTime, totalKills, muted }`.
  - Se valida campo por campo: un campo inválido vuelve a su valor por defecto sin perder los demás.
    `bestTime` se limita a 600 s.
  - Se escribe al terminar la partida (victoria o derrota) y al cambiar el silencio. Salir al menú desde la pausa
    no guarda la partida (no terminó).
  - Se lee al arrancar para mostrar el récord. `localStorage` no requiere gesto; si no existe o lanza, el juego
    sigue con la copia en memoria.
  - "Mejor hora alcanzada" = `shiftClock(bestTime)`; "Nuevo récord" solo si se supera estrictamente.
- **Pantalla de fin:** fila "Hora del turno", aviso "¡Nuevo récord!" y botón secundario "Menú principal".
- **Táctil, revisión con el apuntado nuevo:**
  - Botón "Recargar" debajo de "Cambiar arma" en la esquina inferior derecha (respetan `safe-area-inset`).
    Los dos se ocultan fuera de la partida y en los menús.
  - Línea de apuntado punteada desde Mati mientras el joystick derecho está activo (en táctil no hay mira).
  - El panel del arma muestra "Botones: cambiar arma y recargar" en vez de las teclas. El modo táctil arranca según
    `pointer: coarse` y luego sigue al último puntero usado.
  - En pantallas angostas el reloj baja debajo del botón de pausa (antes se montaba sobre la barra de vida).
- **Depuración:** el dataset suma `trauma` (pico desde la última publicación) y `muted`; `status` vale `paused`
  durante la pausa.

## Hito 6

- **Favicon** en `public/favicon.svg`: un SVG escrito a mano (cabeza de zombi con una etiqueta de precio), sin assets
  externos. Vite lo copia a `dist/` y se enlaza con ruta relativa (`./favicon.svg`) para que funcione en subrutas.
  No hay PNG para `apple-touch-icon`: iOS usa una captura de la página.
- **Meta tags:** descripción, `theme-color`, `color-scheme`, modo app en móviles y Open Graph básico.
  Sin `og:image`, porque necesita una URL absoluta y una imagen; queda para cuando haya dominio.
- **Pantalla de carga** en el HTML, no en JS: "Cargando el turno…" se ve hasta que `main.ts` termina de arrancar
  y la quita. Si el arranque falla, el texto cambia a un error legible. Con JavaScript desactivado, un `<noscript>`
  lo explica.
- **GitHub Pages** con un workflow propio (`.github/workflows/deploy.yml`): Node 22, `npm ci`, lint, tests, build y
  `deploy-pages`. Si falla un test, no se publica. Requiere elegir "GitHub Actions" como fuente en Settings → Pages.
- `viewport-fit=cover` en el viewport para que los `safe-area-inset` de los botones táctiles funcionen en iPhone.

## Hito 7

### Overlay de métricas (F3 y casilla)

- **Un solo estado:** el overlay se ve si `save.showDebug` es verdadero o si hay un parámetro de depuración en la URL.
  F3 y la casilla "Mostrar FPS y métricas" de la pausa cambian el mismo campo y lo guardan al instante (como el silencio).
- **F3 funciona en cualquier pantalla** (menú, partida, pausa) y nunca inicia la partida ni salta el menú.
  Se le hace `preventDefault`, porque en Chrome y Firefox F3 es "buscar siguiente".
- **`?debug` sigue saltando el menú** (como todos los parámetros de depuración; lo usan las pruebas headless) y enciende
  el overlay solo para esa sesión, **sin escribirlo** en el guardado. Con un parámetro activo, F3 y la casilla no lo apagan.
- **Guardado:** `showDebug: boolean` en `deadshift:v1`, por defecto `false`, validado campo por campo como `muted`
  (un valor no booleano vuelve al defecto sin perder lo demás).
- **"Oculto no consume CPU":** con el overlay oculto no se llama a `performance.now()` por frame, no se actualizan las
  estadísticas, no se arma el texto ni se publica el dataset; el costo es una comparación por frame.
  Al encenderlo, `FrameStats.reset()` descarta la media vieja y el primer frame (sin marca de inicio) no se cuenta.
- **Línea:** `FPS · ms · zombis · bajas`. En táctil se dibuja encima del panel del arma, porque abajo a la derecha
  están los botones "Cambiar arma" y "Recargar".
- Todos los parámetros, teclas y claves del dataset están en `docs/DEBUG.md`.

### Bajas por arma

- Cada zombi recuerda la última arma que lo golpeó (`lastHitBy`, índice en `WEAPON_IDS`); la baja se acredita a esa
  arma en `world.killsByWeapon` (un `Int32Array`, sin asignaciones por frame). Proyectiles y microondas guardan el arma
  que los creó.
- El veneno no cambia `lastHitBy`: una baja por veneno va al último golpe directo (normalmente el aerosol que envenenó).
- Se publica en el dataset como `weaponKills` y se imprime en el reporte de balance.

### Balance: Escoba

**Bot de prueba más justo.** Antes de medir se corrigieron dos sesgos del bot que castigaban a la Pistola: disparaba a
zombis fuera del alcance de la bala (el anillo de spawn está a 700 px y la bala llega a ~576 px), gastando munición, y
nunca caminaba hacia los cupones (la Escoba mata pegada a Mati y los recoge sola; la Pistola no). Ahora solo dispara
dentro del 85 % del alcance y, si no hay zombis a menos de 140 px, va al cupón más cercano (≤ 350 px).

**Escenarios** (`BALANCE=1 npx vitest run tests/balance.test.ts`, 12 semillas): `mixed` (pistola y escoba de
respaldo), `broomOnly` (sin munición ni cajas), `gunOnly` (pistola con reserva infinita, sin escoba). Cada uno con
armas automáticas y con "solo manuales" (el bot no toma armas automáticas), que aísla la comparación Pistola / Escoba.
`kpm` = bajas por minuto sobrevivido.

**Hallazgos:**

- Antes, la Escoba sola, **sin munición**, sobrevivía más que el juego normal con Pistola (316 s contra 281 s) y, con
  solo armas manuales, mataba más que la Pistola con munición infinita (576 contra 486 bajas, 113 contra 77 kpm).
- El tiempo de `broomOnly` casi no responde a los nerfs (270-296 s): choca con un "muro" de contenido (Carrito a las
  4:30, jefe a las 5:00). Por eso se miran también las bajas y las `kpm`.
- Debilitar solo la Escoba también hunde a `mixed` (es el salvavidas cuando se acaba la munición). Lo que más ayuda a
  la Pistola no es su daño sino **la economía de munición**: con reserva infinita ya es el arma más fuerte (392 s).

**Palancas probadas** (barrido temporal con 6 a 30 semillas; `broomOnly` con automáticas salvo que se indique):

| Palanca                                           | `broomOnly` | Efecto                                       |
| ------------------------------------------------- | ----------- | -------------------------------------------- |
| Ninguna                                           | 316 s       | —                                            |
| Escoba: cooldown ×1.3                             | 299 s       | Algo; también baja `mixed`                   |
| Escoba: empuje 260 → 170 / 120                    | 312 / 311 s | Casi nada por sí solo                        |
| Escoba: alcance −10 px y arco −15°                | 310 s       | Casi nada por sí solo                        |
| Escoba: daño −2                                   | 301 s       | Algo                                         |
| Escoba: cooldown ×1.3 + empuje 170 + alcance/arco | 290 s       | Bastante; `mixed` baja de 266 a 257 s        |
| + empuje 120, cooldown ×1.5 y daño −2             | 270 s       | Con solo manuales, 78 kpm (= Pistola)        |
| Pistola: perfora desde Nv 3 / +1 daño / cd 0.15   | —           | Sin efecto claro en `mixed`                  |
| Cajas: 18 → 22 % en comunes                       | —           | `mixed` +20-30 s; 25 % no mejora más (ruido) |
| Cajas: 15 → 18 balas                              | —           | Sin mejora medible                           |

**Valores elegidos** (en `data/weapons.ts`; la Pistola no se tocó):

| Nivel | Escoba antes                                    | Escoba ahora                                    |
| ----- | ----------------------------------------------- | ----------------------------------------------- |
| 1     | 12 daño, cd 0.5 s, arco 110°, 75 px, empuje 260 | 10 daño, cd 0.75 s, arco 95°, 65 px, empuje 120 |
| 2     | 16 daño                                         | 14 daño                                         |
| 3     | 140°, 85 px                                     | 125°, 75 px                                     |
| 4     | 20 daño, cd 0.42 s                              | 18 daño, cd 0.63 s                              |
| 5     | ambos lados                                     | ambos lados                                     |

Además, las cajas de munición caen con 22 % (antes 18 %) de los zombis comunes.

**Antes / después** (reporte oficial, 12 semillas):

| Escenario                     | Antes: t / kpm / bajas | Después: t / kpm / bajas |
| ----------------------------- | ---------------------- | ------------------------ |
| `mixed` (con automáticas)     | 281 s / 101 / 477      | **299 s** / 101 / 503    |
| `broomOnly` (con automáticas) | 316 s / 119 / 629      | **272 s** / 107 / 492    |
| `gunOnly` (con automáticas)   | 392 s / 87 / 573       | 392 s / 87 / 573         |
| `mixed` (solo manuales)       | 196 s / 77 / 269       | **253 s** / 91 / 411     |
| `broomOnly` (solo manuales)   | 303 s / 113 / 576      | 284 s / **78** / 366     |
| `gunOnly` (solo manuales)     | 368 s / 77 / 486       | 368 s / 77 / 486         |

Resultado: jugar solo con la Escoba ahora es **peor** que el juego normal con Pistola (272 s contra 299 s), la Escoba
ya no mata más rápido que la Pistola (78 contra 77 kpm) y el juego normal mejoró. La Escoba sigue sirviendo para salir
de un apuro. El bot es una aproximación: falta confirmarlo con partidas reales.

### Botiquín e Imán de suelo

- **Un pool propio** (`world.floorItems`, 16) para los dos, con `kind: 'medkit' | 'magnet'`. Usan el mismo `pull()`
  que los cupones y las cajas de munición (se imantan al entrar en el radio de recogida). Valores en `FLOOR_ITEMS`
  (`data/progression.ts`).
- **Botiquín:** cura 25 % de la vida máxima (con tope). Cae con 4 % de los élite (xp 5: Congelado, Carrito, Cajero) y
  siempre del jefe. **Con la vida llena no se imanta ni se recoge**: queda en el suelo para después.
- **Imán de suelo:** cae con 0.2 % de cualquier zombi (1 o 2 por partida). Al recogerlo, todos los cupones del mapa
  quedan imantados y vuelan hacia Mati; las cajas de munición no.
- Los sorteos usan el RNG sembrado, después del de la caja de munición. Con el pool lleno no cae nada.
- Sonidos propios (`medkitPickup`, `magnetPickup`). Se dibujan como una caja blanca con cruz roja y una herradura roja
  con halo pulsante.

## Hito 8

### Layout y colisión

- **Una sola función de layout:** `shelfInBlock(bx, by, seed)` en `game/shelves.ts` es la fuente de verdad. El render
  la usa para dibujar y la colisión para chocar; no se guarda estado.
- **Datos separados:** la geometría pasó de `SHELVES` (`data/render.ts`) a `SHELF_LAYOUT` en `data/map.ts`, para que
  `game/` no dependa de datos de render. `data/render.ts` conserva solo colores y estilo. **Reemplaza** la indicación
  de CLAUDE.md de ajustar los largos "en `data/render.ts`".
- **Pasillos ≥ 80 px:** se deja 1 tile libre a cada lado del bloque (`marginTiles`). Antes el hueco mínimo entre
  góndolas de bloques vecinos en la misma fila era de 64 px; ahora es de 128 px. Entre filas ya eran ≥ 148 px.
  Como todas las góndolas son horizontales y están separadas en vertical, no hay callejones sin salida. Cambia la
  posición horizontal de algunas góndolas respecto del decorado anterior.
- **Consulta local:** cada entidad mira solo los bloques que toca su caja (1 a 4) y calcula el hash de cada uno al
  momento. Con 300 zombis el juego se mantiene a 60 FPS con ~1 ms de CPU por frame.
- **Círculo contra rectángulo:** el punto más cercano con `clamp`; si el centro quedó adentro, sale por el borde más
  cercano. Como los pasillos son más anchos que cualquier entidad (radio máx. 30), una pasada alcanza.
- **Sistema propio** `shelfCollisionSystem`, después de la separación de la horda, así también corrige lo que empujan
  la separación y el retroceso. Mati sale al borde libre más cercano si queda superpuesto.

### Zombis y góndolas

- **Deslizarse:** con contacto se quita la parte de la velocidad que entra en la góndola. Si casi no queda nada a lo
  largo del borde (Mati justo detrás), el zombi elige un sentido y desliza a velocidad completa:
  - Hacia el extremo del lado donde está Mati, si Mati queda más allá de la góndola en ese eje.
  - Si no, por el camino más corto: hasta la esquina y de ahí en línea recta.

  El sentido se mantiene mientras dure el contacto. Sin eso, al avanzar cambia el ángulo hacia Mati y el zombi
  vuelve hacia el centro y oscila.

- **Contacto con margen de 1 px** (`contactSkin`): un zombi que desliza pegado al borde sigue "tocando", así no pierde
  el sentido elegido.
- **Atasco = no desplazarse:** el zombi cuenta tiempo de atasco si toca una góndola, quiere acercarse a Mati, no se
  movió 24 px desde que empezó a contar y está a más de 100 px de Mati. A los 1.5 s vuelve al anillo de spawn
  (`relocateToRing`).
  - La primera versión medía "no se acerca a Mati". Daba 866 reubicaciones por partida: rodear una góndola larga aleja
    al zombi durante segundos, y la horda apilada contra un estante junto a Mati no puede acercarse más.
  - Con la métrica de desplazamiento, una partida simulada completa da entre 0 y 61 reubicaciones (14 en promedio),
    contra cientos de bajas.
  - No cuenta un Cajero que retrocede (no quiere acercarse) ni a la horda que pelea junto a Mati.
- **Carrito:** si choca con una góndola mientras embiste, la embestida termina y pasa a recuperarse.

### Qué bloquean

- **Bloquean** todas las balas del jugador: la Pistola y también las latas, que comparten el pool de proyectiles. Al
  chocar sueltan unas chispas (evento `shelfHit`, sin sonido). Los recibos del Cajero explotan al tocar una góndola.
- **No bloquean:** barridos de la Escoba, onda del jefe, aerosol, bolsas de hielo e imantado de pickups (como pide el
  hito). Los rayos del microondas tampoco: el hito no los menciona y es lo más simple.

### Spawns

- `spawnEnemy` expulsa al enemigo de cualquier góndola. Eso cubre oleadas, grupos, jefe, invocaciones del jefe, horda
  de debug y reubicaciones. El microondas (radio 16) y el cofre también se expulsan al colocarse.
- Mati arranca en (0, 0), que siempre está libre: las góndolas empiezan ≥ 74 px dentro de su bloque. Hay un test con
  500 semillas.

### Aspecto

Se dibujan exactamente sobre su huella de colisión, con una sombra más oscura y desplazada, una franja frontal oscura de
10 px que da altura y un borde superior iluminado.

### Efecto en el balance

El bot de prueba ahora retiene el disparo si hay una góndola en la línea de tiro. Una persona no dispara contra un
estante, y sin esa regla el bot gastaba munición. Reporte de 12 semillas:

| Escenario                     | Hito 7 (sin góndolas) | Hito 8 (con góndolas) |
| ----------------------------- | --------------------- | --------------------- |
| `mixed` (con automáticas)     | 295 s / 97 kpm        | 240 s / 89 kpm        |
| `broomOnly` (con automáticas) | 276 s / 108 kpm       | 256 s / 103 kpm       |
| `gunOnly` (con automáticas)   | 407 s / 88 kpm        | 330 s / 79 kpm        |
| `mixed` (solo manuales)       | 238 s / 83 kpm        | 172 s / 64 kpm        |
| `broomOnly` (solo manuales)   | 292 s / 81 kpm        | 248 s / 66 kpm        |
| `gunOnly` (solo manuales)     | 362 s / 79 kpm        | 318 s / 70 kpm        |

Las góndolas frenan las balas pero no la Escoba, así que el cuerpo a cuerpo gana fuerza relativa: con automáticas,
"solo Escoba" (256 s) vuelve a durar más que el juego normal (240 s). Parte de la caída es del bot, que no se mueve
para buscar tiro limpio. **No se rebalanceó en este hito:** queda pendiente decidir si se compensa (por ejemplo, con
más alcance de la Pistola o más munición) después de probar partidas reales.
