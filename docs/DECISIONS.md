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

- **Curva de XP.** ~~`5 + N*4 + floor(N^1.5)` es el XP para _llegar_ al nivel N (lectura literal): 15 para el 2, 22 para el 3,
  30 para el 4...~~ **Reemplazada en Hito 9.5:** `4 + 2N` (8 para el 2, 10 para el 3...). El sobrante se conserva. Si una recogida da varios niveles, se encolan y las pantallas salen una tras otra.
- **Ofertas.** Se arma la lista de candidatos válidos (arma nueva si hay < 4 armas, mejora si el nivel es < 5,
  y lo mismo para los pasivos) y se sacan hasta 3 distintos con el RNG sembrado (Fisher-Yates parcial).
  Si hay menos de 3 candidatos se muestran los que haya; sin ninguno, la única opción es curar 30 %.
  ~~Todos los candidatos pesan igual.~~ **Reemplazada en Hito 9.5:** pesos por tipo de carta (`offerWeights`).
- **Reroll:** ~~1 por partida~~ 3 por partida desde el Hito 9.5 (`PROGRESSION.rerollsPerRun`); vuelve a sortear desde cero (puede repetir alguna opción).
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
- **Jefe 2 "más fuerte":** ×1.5 vida y ×1.25 daño, además del escalado por minuto (a los 9:00 ya es ~~×1.72~~ ×1.45 desde el Hito 9.5).
  Si la arena está en el tope de 400, se elimina el zombi común más lejano para que el jefe siempre aparezca.
- **Escalado:** vida y daño × (1 + ~~0.08~~ 0.05 × minutos) (**cambiado en Hito 9.5**), calculado al aparecer con el tiempo continuo, no por minuto entero.
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
  ~~pero nunca aparecen como "arma nueva".~~ (**Reemplazada en Hito 9:** la Escopeta sí sale como arma nueva.) **Reemplaza** "empieza con la Escoba" (CLAUDE.md §5.2): Mati arranca con pistola
  y escoba manuales y sin armas automáticas.
- **Mira = dirección del personaje.** Con mouse o joystick de apuntado, `facing` sigue a la mira: Mati gira hacia ella y
  el aerosol y el microondas también apuntan con el mouse. **Reemplaza** "el jugador mira hacia donde se mueve" (CLAUDE.md §5.2).
  Sin mouse ni joystick de apuntado (solo teclado), la mira sigue al movimiento y Espacio dispara.
- **Controles:**
  - Escritorio: WASD/flechas para moverse, mouse para apuntar, clic mantenido (o Espacio) para disparar o golpear,
    R para recargar, Q o la rueda para cambiar de arma (la rueda espera 200 ms entre cambios por los trackpads).
    **Ampliado en Hito 9:** con tres armas, Q y la rueda ciclan y 1/2/3 seleccionan.
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

- **Cajas de munición:** ~~15~~ 20 balas cada una (**cambiado en Hito 9**). Probabilidad de caída según el XP del enemigo:
  - ~~18 %~~ ~~22 %~~ 28 % los comunes (xp 1) (**cambiado en Hitos 7 y 9**).
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
    barra de "Recargando", "SIN MUNICIÓN" en rojo, ~~y la munición entre paréntesis si se eligió la Escoba con balas~~
    (**reemplazada en Hito 9** por la fila de armas manuales encima del panel).
  - Las armas automáticas muestran una sombra que baja con su cooldown.
- **Depuración:** `?ammo=N` arranca con el cargador vacío y N balas de reserva (con `?ammo=0` arranca directo en la Escoba).
  ~~`?weapons=all` deja las 4 automáticas y las 2 manuales en nivel 5, con la reserva llena.~~ (Hito 9: también la escopeta.)
  El dataset suma `active`, `ammo`, `reloading`, `ammoBoxes` y `manualLevels` (formato cambiado en Hito 9).

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

## Hito 9

### Escopeta

- **Tercera arma manual**, también en `player.manual`. Reutiliza el comportamiento `'gun'` (cargador, reserva y
  recarga) con un look propio de perdigón. Valores en `data/weapons.ts`:

  | Nivel | Escopeta                                                                                                       |
  | ----- | -------------------------------------------------------------------------------------------------------------- |
  | 1     | 5 perdigones en ±15°, 6 de daño c/u, 600 px/s × 0.37 s ≈ 220 px, cd 0.9 s, cargador 6, recarga 2 s, empuje 260 |
  | 2     | 7 de daño                                                                                                      |
  | 3     | 6 perdigones, cargador 8                                                                                       |
  | 4     | recarga 1.6 s, cd 0.75 s                                                                                       |
  | 5     | 7 perdigones, 8 de daño, perfora 1                                                                             |

  Al obtenerla trae el cargador lleno y 12 cartuchos de reserva (tope 36). El empuje no se suma entre perdigones:
  cada impacto pisa el anterior, así que el empuje "fuerte" es el valor por perdigón.

- **Cómo se obtiene:** con el campo `offerFromLevel: 4` del arma, desde el nivel 4 puede salir como "arma nueva" en
  las ofertas. No ocupa slot de arma automática y es la única manual que sale así.
  - **El primer cofre** de la partida (contador `player.chestsOpened`) la ofrece siempre como una de sus 3 opciones si
    no la tienes. Las otras dos siguen siendo mejoras de armas.
- **Las góndolas frenan los perdigones** igual que las balas (Hito 8).

### Estado manual y cambio de arma

- `ManualState` tenía `gun` / `melee` y una sola munición. Ahora es una lista `owned` de `{ weapon, mag, reserve }` en
  el orden `MANUAL_ORDER` (Pistola, Escopeta, Escoba), y `active` es el id del arma. La recarga es la del arma activa,
  y cambiar de arma la cancela, como antes.
- **Teclas fijas** (decisión del usuario): 1 Pistola, 2 Escoba, 3 Escopeta (`MANUAL_KEYS`). Así nunca cambian de
  significado al conseguir la escopeta.
  - La tecla de un arma que no tienes, que está en 0/0 o que ya tienes en mano no hace nada.
  - Con un menú abierto se descartan (`clearEdges`), igual que Q y R.
- **Q, la rueda y el botón táctil** ciclan por `MANUAL_ORDER` y saltean las armas de fuego sin munición.
- **Cambio automático:** con el arma activa en 0/0 pasa a la siguiente arma de fuego con munición en el orden (dando
  la vuelta). Si no queda ninguna, va a la Escoba (`autoSwitched = true`).
- **Vuelta automática:** al recoger munición del arma W, si el arma activa la eligió el cambio automático y está
  después de W en el orden, vuelve a W y recarga.
  - Una caja de balas devuelve de la Escopeta automática a la Pistola.
  - Unos cartuchos devuelven de la Escoba a la Escopeta.
  - Si el jugador eligió el arma a mano, se respeta.
- **Debug:** `?weapons=all` incluye la escopeta en nivel 5 con todo lleno, y `?ammo=N` sigue siendo de la Pistola. Las
  dos viven en `game/debug.ts`, como funciones puras con tests.

### Cajas de cartuchos

- Pool propio (`world.shellBoxes`, 30), cajas rojas. La probabilidad total de caída de munición no cambia.
- Cuando tienes la escopeta, un segundo sorteo del RNG decide que el 40 % (`shellShare`) sean de cartuchos (6 c/u) y
  el resto de balas. Antes de tenerla nunca caen cartuchos.

### Mods de Pistola

- Hay un tipo de oferta nuevo, `pistolMod`. Aparece desde la Pistola nivel 3, como máximo 2 por partida y sin
  repetirse. Los mods no suben nivel ni ocupan slots: se guardan en `manual.mods` y se ven como íconos junto a la fila
  de armas.
- Se aplican sobre los stats del nivel actual (`applyPistolMods`). Una caché los rehace solo si cambian el nivel o los
  mods, así que no se crean objetos por frame.
  - **Perforante:** +1 perforación.
  - **Cargador extendido:** cargador ×1.5 (redondeado). Sube el máximo, pero el cargador actual no se llena solo.
  - **Incendiaria:** 4 de daño/s durante 2 s. Reutiliza el veneno del aerosol (`poisonDps` / `poisonTimer`, gana el
    más fuerte) y lo descuenta `statusSystem`. Como el veneno, no muestra números.
  - **Rebote** (decisión del usuario: hacia otro zombi): cuando la bala se agotaría al impactar, salta una vez al
    zombi vivo más cercano que no golpeó, a ≤ 220 px, con vuelo nuevo suficiente para llegar.

### HUD y render

- Encima del panel del arma hay una fila con las armas manuales que tienes: tecla, ícono y munición.
  - El arma activa va resaltada y las que están en 0/0 se ven apagadas.
  - La pista dice `1/2/3 · Q: cambiar · R: recargar`.
- Mati sostiene una escopeta (culata de madera y cañón largo) y los perdigones son bolitas doradas.

### Balance

El bot usa la escopeta (tecla 3) cuando el objetivo está a su alcance y le quedan cartuchos, y la Pistola si no.

Con la escopeta sola, el juego normal seguía por debajo de "solo Escoba": 219 s contra 249 s con automáticas. La
Pistola con munición infinita duraba 329 s, así que el límite era la munición (desde el Hito 8 las góndolas se comen
balas). Barrido del juego normal con 16 semillas:

| Variante                     | Con automáticas | Solo manuales |
| ---------------------------- | --------------- | ------------- |
| Hito 8 (caída 22 %, caja 15) | 216 s           | 159 s         |
| Caída 28 %                   | 262 s           | 203 s         |
| Caída 34 %                   | 249 s           | 206 s         |
| Caja de 20 balas             | 237 s           | 207 s         |
| **Caída 28 % + caja 20**     | **255 s**       | **257 s**     |
| Caída 34 % + caja 20         | 257 s           | 246 s         |

**Valores elegidos:** las cajas caen del 28 % de los zombis comunes (antes 22 %) y traen 20 balas (antes 15).

Reporte oficial (12 semillas):

| Escenario                     | Hito 8         | Hito 9 final   |
| ----------------------------- | -------------- | -------------- |
| `mixed` (con automáticas)     | 240 s / 89 kpm | 243 s / 77 kpm |
| `broomOnly` (con automáticas) | 256 s          | 257 s          |
| `mixed` (solo manuales)       | 172 s / 64 kpm | 257 s / 75 kpm |
| `broomOnly` (solo manuales)   | 248 s / 66 kpm | 235 s / 68 kpm |

Con solo armas manuales, el juego normal vuelve a superar con claridad a "solo Escoba" (257 s contra 235 s). Con
automáticas sigue algo por debajo (243 s contra 257 s). Esa brecha viene sobre todo de la experiencia: la Escoba mata
pegada a Mati y recoge los cupones al instante, así que el bot de Escoba sube más de nivel y llega con más armas
automáticas. No se tocó más; queda por confirmar con partidas reales.

## Hito 9.5

### Bot por minuto

`tests/balance.test.ts` (`BALANCE=1`) mantiene los 6 escenarios anteriores y suma una tabla por minuto (cortes en
2, 4, 6, 8 y 10) para tres escenarios de 12 semillas:

- `mixed` mortal: solo cuentan las partidas vivas en cada corte.
- `curve`: `mixed` con modo dios, así las 12 llegan a las 6 AM y se mide la curva entera.
- `weaponsAll`: todas las armas en nivel 5 (`giveAllWeapons`) y modo dios. Es el techo de poder del jugador.

Columnas: nivel, mejoras (niveles + cofres), XP total (`Σ xpForLevel + xp`), vida media de los zombis vivos (sin el
jefe), enemigos en pantalla (media de la ventana), DPS (daño de `world.hits`, que el bot vacía en cada paso; **no
incluye veneno ni incendiaria**), tiempo teórico de la Pistola para matar un Cliente (DPS sostenido con recarga, un
solo objetivo), bajas/s y apariciones/s (`Δcount + Δkills`; las reubicaciones no cuentan). Al final, una proyección
de qué nivel daría cada curva candidata con la XP medida.

### Palanca 1: curva de XP

**Elegida `4 + 2N`** (se prueba primero porque, con la XP que ya da una partida, es la única que llega a 35-40
niveles; `5+3N+N^1.2` se queda en ~26). La fórmula en datos es `xpBase + xpPerLevel·N + ⌊xpPowerCoef·N^xpExponent⌋`;
`xpPowerCoef: 0` la vuelve lineal sin código nuevo.

Antes / después (`curve`, modo dios, 12 semillas):

| Min | Nivel antes | Nivel después | XP antes | XP después | Bajas/s vs apariciones/s antes | Después     |
| --- | ----------- | ------------- | -------- | ---------- | ------------------------------ | ----------- |
| 2   | 3.6         | 6.8           | 73       | 86         | 0.99 / 1.37                    | 1.05 / 1.37 |
| 3   | 4.7         | **8.3**       | 109      | 118        | —                              | —           |
| 4   | 5.8         | 10.3          | 172      | 162        | 1.64 / 2.32                    | 1.71 / 2.32 |
| 5   | 7.8         | **12.1**      | 280      | 217        | —                              | —           |
| 6   | 9.3         | 17.7          | 411      | 432        | 1.96 / 3.36                    | 2.62 / 3.35 |
| 8   | 13.3        | 25.3          | 803      | 823        | 3.22 / 3.19                    | 4.31 / 4.22 |
| 10  | 16.4        | **39.4**      | 1266     | 1889       | 3.73 / 3.80                    | 6.17 / 6.03 |

DPS al minuto 10: 184 → 311. Zombis en pantalla al minuto 6: 199 → 156. Tiempo de la Pistola por Cliente al
minuto 10: 0.79 → 0.35 s.

Partidas mortales (12 semillas):

| Escenario                     | Antes          | Después         |
| ----------------------------- | -------------- | --------------- |
| `mixed` (con automáticas)     | 243 s / 77 kpm | 310 s / 94 kpm  |
| `broomOnly` (con automáticas) | 257 s          | 311 s           |
| `gunOnly` (con automáticas)   | 331 s          | 314 s           |
| `mixed` (solo manuales)       | 257 s / 75 kpm | 313 s / 100 kpm |
| `broomOnly` (solo manuales)   | 235 s          | 280 s           |
| `gunOnly` (solo manuales)     | 323 s          | 392 s           |

`mixed` mortal: al minuto 4 seguían vivas 5 de 12 y ahora 12 de 12; al minuto 6, 0 y ahora 1.

**Lectura:**

- El final de partida queda en el objetivo (39 niveles, 35-40). El arranque se queda corto: 8 al minuto 3 (objetivo
  ~10) y 12 al minuto 5 (objetivo ~18). No es la curva, es la XP que entra: el bot junta solo ~120 XP en 3 minutos y
  ~220 en 5. Con esa XP ninguna curva razonable da 18 niveles al minuto 5.
- `weaponsAll` (techo de poder) mantiene la horda baja (≤ 86 en pantalla), así que el escalado enemigo no es un muro
  absoluto. Con la build normal, entre los minutos 4 y 6 aparecen más zombis de los que mueren.
- El bot mortal sigue muriendo alrededor de las 5:10 (Carrito y primer jefe). Como pide el hito, eso sirve para
  comparar, no como dificultad absoluta.

### Ajustes del bot (antes de medir la palanca 2)

- **Usa los rerolls:** si una pantalla de nivel no trae ninguna carta de arma (nueva o mejora) y le quedan rerolls,
  vuelve a sortear (`botWantsReroll`). Sin eso, la palanca de los rerolls no se podía medir.
- **Límite del bucle por tiempo de juego,** no por vueltas. Con la curva nueva, los niveles encadenados gastaban vueltas
  sin avanzar el reloj y 2 de las 12 partidas en modo dios no llegaban al minuto 10.
- Columna nueva `wpnLv`: suma de los niveles de todas las armas que tiene (manuales y automáticas).

Con estos cambios la base (`4+2N`, 1 reroll, pesos iguales) quedó: `mixed` 307 s, `mixed` solo manuales 303 s y, en
`curve`, nivel 12.6 al minuto 5 y 42.3 al minuto 10.

### Palanca 2: pesos de las ofertas y rerolls

- **Sorteo con pesos sin reposición:** en cada carta se elige un candidato con probabilidad proporcional a su peso
  (`offerWeight`) y se saca de la lista. Gasta un número del RNG por carta, como antes, así que sigue siendo
  determinista. Con pesos iguales es el mismo sorteo uniforme de antes. El cofre usa el mismo sorteo (solo trae
  mejoras de armas, así que no cambia).
- **Pesos** en `PROGRESSION.offerWeights`: mejora de un arma que ya tienes 2.5; arma nueva, pasivo nuevo, mejora de
  pasivo y mod de Pistola 1.
- **Rerolls:** 3 por partida. El botón dice "(restantes: N)", que funciona en singular y en plural.

Barrido (12 semillas; `mixed` = juego normal mortal; `curve` = modo dios):

| Variante                                     | `mixed` autos | `mixed` solo manuales | `curve` nv min 5 | `curve` nv min 10 | `curve` XP min 10 |
| -------------------------------------------- | ------------- | --------------------- | ---------------- | ----------------- | ----------------- |
| Base: 1 reroll, pesos iguales                | 307 s         | 303 s                 | 12.6             | 42.3              | 2159              |
| Solo 3 rerolls                               | 304 s         | 309 s                 | 12.7             | 39.5              | 1937              |
| **3 rerolls + mejoras ×2.5 (aplicada)**      | **292 s**     | **382 s**             | **14.2**         | **34.0**          | **1446**          |
| 3 rerolls + mejoras ×2.5 + armas nuevas ×2.5 | 299 s         | 341 s                 | 11.4             | 37.0              | 1659              |

**Lectura:**

- **Los rerolls solos no cambian nada medible** (dentro del ruido de 12 semillas).
- **El peso en las mejoras ayuda mucho cuando la build depende de pocas armas:** con solo manuales, +79 s. En el juego
  normal no ayuda (−15 s, cerca del ruido), y en modo dios se termina con menos XP. Al pesar más las mejoras, salen
  menos cartas de arma automática nueva; el bot llega con menos daño en área y la horda tarda más en morir.
- **El bot ya elegía siempre armas antes que pasivos,** así que los pesos lo afectan menos que a una persona que toma
  pasivos. Por eso la decisión final depende de una partida real.
- **La palanca 2 no cierra la brecha del arranque:** al minuto 5 sigue en 14 niveles contra ~18 del objetivo.

### Palanca 4: escalado de los enemigos

El reporte suma de dónde viene el daño que recibe el bot (`hurtSource`): el zombi más fuerte que lo toca en ese paso o,
si no hay ninguno, `ranged` (recibos y onda del jefe). También lista los tiempos de muerte de cada semilla.

Con las palancas 1 y 2 aplicadas, el bot muere entre los 196 y los 357 s. Daño recibido: Cliente 46 %, `ranged` 21 %
(sobre todo la onda del primer jefe), Congelado 17 %, Carrito 11 % y Repartidor 4 %. Es la horda común la que lo
alcanza: entre los minutos 4 y 6 aparecen más zombis de los que mueren.

Barrido (12 semillas, una palanca por prueba):

| Variante                                          | `mixed` autos | Muerte más temprana | `curve` nv min 10 | Vida media zombi min 10 |
| ------------------------------------------------- | ------------- | ------------------- | ----------------- | ----------------------- |
| Base (palancas 1 y 2)                             | 292 s         | 196 s               | 34.0              | 48.5                    |
| **Escalado 8 % → 5 % por minuto (aplicada)**      | **312 s**     | **258 s**           | 37.8              | 40.0                    |
| Clientes min 3-5: 1.8/2.0/2.0 → 1.5/1.7/1.8 por s | 302 s         | 229 s               | 36.4              | 49.0                    |

**Elegido:** `COMBAT.scalingPerMinute` 0.05 (antes 0.08). Afecta vida y daño, también de los recibos, la onda y los
jefes: el jefe 2 queda en ×1.45 por escalado (antes ×1.72), además de su ×1.5 de vida.

- Ya no hay muertes antes de los 4 minutos, que es lo que más se parece al jugador real que se trababa.
- El promedio sube poco (+20 s). El muro del bot sigue entre los minutos 4.5 y 6 (Carrito, primer jefe, Congelados), y
  ahora el Congelado pesa más en el daño recibido (30 %).
- La densidad de oleadas no se tocó: ayudó menos y le saca XP al arranque.
- `weaponsAll` sigue limpiando la horda (≤ 90 zombis en pantalla), así que con una build completa el juego no queda
  imposible. Falta confirmar con partidas reales que no quede trivial.

### Cierre

Validado con partidas reales: con las tres palancas (curva `4+2N`, pesos con 3 rerolls y escalado al 5 %), el jugador
llega a las 6 AM. La palanca 3 (pasivos con nivel máximo 3) no hizo falta.

## Hito 10

### Representación: la evolución es el nivel 6

- Cada tabla `levels` de `data/weapons.ts` tiene un elemento más que `PROGRESSION.maxLevel`: los stats evolucionados.
  Evolucionar es `weapon.level = EVOLVED_LEVEL` (6). Las ofertas normales siguen deteniéndose en 5.
- **Por qué:** todo lee los stats con `statsAt(def.levels, w.level)`, así que armas, manuales, render, HUD y la caché de
  mods funcionan sin casts ni código de lookup nuevo. El arma conserva su id: el slot (o su lugar manual), la tecla
  1/2/3, la munición, los mods de Pistola y las bajas por arma quedan igual. "Reemplaza al arma base en su slot" sale
  de gratis.
- **Recetas** en `data/evolutions.ts`: `{ id, weapon, passive, icon, nameKey, descKey }` y
  `EVOLUTION_RULES.minPassiveLevel = 3`. El nivel 5 del arma sale de `PROGRESSION.maxLevel`. Lógica pura en
  `game/evolutions.ts` (`recipeStatus`, `readyEvolutions`, `evolveWeapon`, `isEvolved`, `weaponIcon`, `weaponNameKey`).
- **El pasivo no se consume** al evolucionar. El Chaleco sirve para dos recetas (Escopeta y Microondas).

### Ofertas

- Tipo nuevo `evolveWeapon`. **Una evolución lista aparece siempre**, en la pantalla de nivel y en el cofre: las
  evoluciones van primero y el resto se completa con el sorteo con pesos. Si hay más de 3 listas, salen 3.
  - En el primer cofre, la escopeta garantizada va antes que las evoluciones.
  - Mientras no haya ninguna receta lista, el sorteo es idéntico al de antes (mismo consumo del RNG).
- La carta de evolución tiene borde dorado y la etiqueta "EVOLUCIÓN".
- **Receta visible:** las cartas de arma muestran "⚡ Escoba eléctrica: arma Nv 5 (tienes 3) + 🧲 Imán de heladera
  Nv 3 ✓". Las de pasivo muestran "Evoluciona 🧹 con Nv 3" si completan la receta de un arma que ya tienes.
- **HUD:** el arma evolucionada muestra el ícono de la evolución con marco dorado y "EVO" en vez del nivel. El panel
  del arma manual dice "Pistola láser · EVO".

### Las 7 evoluciones (nivel 6 en `data/weapons.ts`)

| Evolución                  | Receta                | Cambios                                                 | Mecánica                                                                                |
| -------------------------- | --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Escoba eléctrica ⚡        | Escoba + Imán         | 22 daño, cd 0.55 s, ambos lados                         | Descarga desde el primer zombi golpeado: salta a 4 más a ≤ 120 px, con el 60 % del daño |
| Pistola láser 🔴           | Pistola + Calculadora | 16 daño, cd 0.09 s, 1100 px/s, cargador 30, recarga 1 s | Perfora 11 (todo lo que una bala puede recordar)                                        |
| Escopeta antidisturbios 🛡️ | Escopeta + Chaleco    | 9 perdigones de 9 daño                                  | Perfora 3, empuje 650                                                                   |
| Latas granada 💣           | Latas + Café          | 4 latas de 18 daño, cd 0.8 s                            | Explotan al tocar un zombi o una góndola: radio 60, 12 de daño                          |
| Lanzallamas casero 🔥      | Aerosol + Termo       | 7 daño cada 0.2 s, 3 s activo, cd 1.5 s, 170 px, 70°    | Quemadura 8/s × 3 s (el veneno de siempre), cono naranja                                |
| Ventisca 🌨️                | Hielo + Zapatillas    | 6 bolsas, radio 130, 12 daño, 4.5 rad/s                 | `slowFactor 1` = congela 1.2 s (también al jefe)                                        |
| Microondas industrial 🏭   | Microondas + Chaleco  | 3 unidades, 5 rayos de 14 daño, cd 0.5 s, 280 px, 12 s  | —                                                                                       |

- **Cambios de soporte:**
  - `COMBAT.maxProjectileHits` pasa de 4 a 12, para que el láser "perfore todo".
  - `MAX_TURRET_RAYS` pasa de 4 a 5.
  - Los niveles de proyectil admiten `look`, que pisa el aspecto del arma (el láser).
- **Descarga eléctrica:** un pool nuevo `world.arcs` (64 segmentos, 0.15 s) solo para el render, que avejenta
  `arcSystem`. El render dibuja zigzags con un hash (sin `Math.random` ni objetos nuevos).
- **Explosión de las latas:** un evento propio `canExplosion` (partículas chicas y sonido corto), **sin screen shake**.
  Con 4 latas cada 0.8 s, el `explosion` de los recibos sacudía la pantalla todo el tiempo. Esto cambia lo que decía el plan.
- Sonido nuevo `chainZap` para la descarga.

### Debug

`?weapons=evolved`: como `?weapons=all`, pero con las 7 evoluciones (`giveAllWeapons(world, true)`).

### Balance

El bot ahora prioriza las cartas de evolución. Reporte de 12 semillas:

- **Partidas mortales:** muere entre los 258 y los 376 s, antes de poder evolucionar nada (0/12).
- **Modo dios (`curve`):** evoluciona en 3 de 12 partidas, desde el minuto 8.8. Su cuello de botella es el pasivo en
  Nv 3: el bot elige armas antes que pasivos y no apunta a una receta. Una persona que busca la receta debería
  llegar antes.
- No se ajustaron los números de la receta. Queda por confirmar con partidas reales si llegan demasiado tarde.
