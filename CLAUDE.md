# DEAD SHIFT — Survivor-like zombi en un supermercado 24h

Eres el repositor del turno de noche. A las 10 PM se apagan las luces y los clientes
se levantan... distintos. Sobrevive hasta las 6 AM usando lo que encuentres en las góndolas.

Este archivo es la fuente de verdad del proyecto. Léelo completo antes de escribir código.
Si algo no está especificado, decide lo más simple que funcione y anótalo en `docs/DECISIONS.md`.

---

## 1. Objetivo y alcance

- Juego 2D top-down, survivor-like con control manual: el jugador se mueve y apunta, las armas manuales
  (pistola, escoba y más adelante la escopeta) se disparan a mano y las demás armas disparan solas.
  Los enemigos llegan en oleadas, se sube de nivel y se eligen mejoras.
- **Entregable mínimo (MVP):** sitio estático jugable en navegador (desktop y móvil con joystick táctil),
  sin backend, desplegable en itch.io / GitHub Pages / Netlify / Vercel con solo subir la carpeta `dist/`.
- **Escalable:** todo el contenido (armas, enemigos, mejoras, oleadas) vive en datos, no en `if`s.
  Agregar un arma o enemigo nuevo debe requerir tocar 1 archivo de datos (+ opcionalmente 1 de comportamiento).
- Cero assets externos: todo se dibuja con Canvas 2D (formas, colores, emojis opcionales) y el sonido
  se sintetiza con WebAudio. Así el proyecto pesa casi nada y no hay problemas de licencias.

## 2. Stack

- Vite + TypeScript (strict) + Canvas 2D. **Sin motores de juego ni frameworks UI.**
- Vitest para tests de lógica pura.
- ESLint + Prettier.
- Sin dependencias de runtime (solo devDependencies).
- `vite.config.ts` con `base: './'` para que funcione en cualquier hosting estático.

### Comandos (deben existir en package.json)

```
npm run dev        # servidor de desarrollo
npm run build      # tsc --noEmit && vite build  -> dist/
npm run preview    # sirve dist/
npm run test       # vitest run
npm run lint       # eslint .
```

## 3. Estructura de carpetas

```
src/
  main.ts                # arranque, carga, bucle principal
  core/
    loop.ts              # timestep fijo 60 Hz + render con requestAnimationFrame
    rng.ts               # RNG con semilla (mulberry32), nunca usar Math.random en lógica
    input.ts             # teclado (WASD/flechas), joystick táctil, pausa
    camera.ts            # sigue al jugador, shake
    pool.ts              # object pool genérico
    spatial-hash.ts      # rejilla espacial para colisiones
    math.ts              # vectores, clamp, lerp
  game/
    world.ts             # estado de la partida (entidades, reloj, rng)
    player.ts
    enemies.ts           # comportamientos (chase, charge, ranged...)
    weapons.ts           # comportamientos (projectile, orbit, arc, cone, turret...)
    projectiles.ts
    pickups.ts           # cupones (XP), cajas de munición, botiquines, imán
    spawner.ts           # oleadas según el reloj
    progression.ts       # XP, niveles, ofertas de mejoras
    systems/             # un archivo por sistema: movement, collision, damage, ...
  data/
    weapons.ts           # definiciones de armas y niveles 1-5
    enemies.ts           # definiciones de enemigos
    upgrades.ts          # pasivos
    waves.ts             # tabla de oleadas por minuto
    evolutions.ts        # recetas de evolución de armas (Hito 10)
  render/
    renderer.ts          # dibuja el mundo
    sprites.ts           # funciones que dibujan cada entidad con formas
    particles.ts
    hud.ts               # vida, XP, reloj, kills
  ui/
    menu.ts              # menú principal, game over, victoria, pausa
    levelup.ts           # pantalla de elección de 3 mejoras
  audio/
    sfx.ts               # sonidos sintetizados con WebAudio
  save/
    storage.ts           # localStorage: mejor tiempo, kills totales, ajustes
tests/                   # tests de lógica pura (progression, spawner, damage, rng...)
docs/DECISIONS.md        # decisiones de diseño tomadas durante el desarrollo (léelo antes de cada hito)
docs/DEBUG.md            # parámetros de URL y teclas de depuración (Hito 7)
```

## 4. Reglas de arquitectura (importantes)

1. **Separar lógica de render.** `game/` nunca toca el canvas ni el DOM. `render/` nunca modifica el estado.
2. **Timestep fijo** a 60 Hz para la lógica; el render puede ir a la frecuencia del monitor.
3. **Data-driven.** Armas, enemigos, mejoras y oleadas son objetos tipados en `src/data/`.
   El código solo interpreta esos datos.
4. **Object pools** para proyectiles, enemigos, partículas y cupones. Prohibido crear objetos por frame en el bucle caliente.
5. **Colisiones con spatial hash**, no O(n²).
6. **Determinismo:** toda la aleatoriedad de gameplay usa `rng.ts` con semilla. Esto permite tests y reproducir bugs.
7. **Un sistema = una responsabilidad.** Los sistemas se ejecutan en orden fijo declarado en un solo lugar (`world.ts`).
8. Tipos estrictos, sin `any`. Funciones pequeñas. Nombres en inglés en el código, textos visibles al jugador en español.
9. Los textos del juego van centralizados (para poder agregar otro idioma luego).

## 5. Diseño del juego

### 5.1 Ciclo de partida

- Duración: **10 minutos reales = turno de 10 PM a 6 AM** (1 min real ≈ 48 min de reloj del juego). El reloj aparece en el HUD.
- **Victoria:** llegar a las 6:00 AM con vida. Amanece, los zombis se desmayan (animación simple).
- **Derrota:** vida a 0. Mostrar hora a la que moriste, kills y nivel.
- Mapa: arena infinita (el mundo se genera con tiles de piso de supermercado: baldosas claras con líneas y góndolas
  derivadas de una función hash con semilla). Las góndolas son decorativas hasta el Hito 8, donde pasan a ser sólidas.
  Sin límites; la cámara sigue al jugador.

### 5.2 Jugador: "Mati, el repositor"

| Stat | Valor base |
|---|---|
| Vida | 100 |
| Velocidad | 150 px/s |
| Radio de recogida | 60 px |
| Invulnerabilidad tras golpe | 0.5 s |

- Movimiento con WASD/flechas o joystick virtual en pantalla táctil (mitad izquierda).
- **Armas manuales** (Pistola de etiquetas, Escoba y, desde el Hito 9, la Escopeta): se apuntan con el mouse o el joystick
  derecho (mitad derecha en táctil) y se disparan con clic, Espacio o el joystick de apuntado. Mati mira hacia la mira.
  Viven en `player.manual`, fuera de los slots.
- **Armas automáticas** (latas, bolsas de hielo, aerosol, microondas): disparan solas.
- Slots: máximo **4 armas automáticas** y **4 pasivos**.
- Empieza con la **Pistola de etiquetas** y la **Escoba**, sin armas automáticas.
- Controles: R recarga, Q o rueda cambian de arma (en el Hito 9, 1/2/3 seleccionan), Esc/P pausa, M silencio.

### 5.3 Experiencia y niveles

- Los zombis sueltan **cupones** (gemas de XP; 1, 5 y 20 de valor según el enemigo).
- Curva de XP para subir al nivel N: `5 + N * 4 + floor(N^1.5)`.
- Al subir de nivel: el juego se pausa y se ofrecen **3 opciones al azar** (nueva arma, mejorar arma, pasivo, o curar 30% si no hay nada).
- Botón "Reroll" 1 vez por partida (se amplía luego).

### 5.4 Armas (niveles 1 a 5)

Los números definitivos viven en `src/data/weapons.ts` y las decisiones de diseño en `docs/DECISIONS.md`
(Hitos 3 y 4.5). Si algo difiere de lo escrito aquí, mandan el código y `DECISIONS.md`.

**Manuales** (se apuntan; viven en `player.manual`, fuera de los slots):

| Arma | Comportamiento | Nivel 1 | Mejoras por nivel |
|---|---|---|---|
| **Pistola de etiquetas** (inicial) | Disparo manual con cargador, reserva de munición y recarga (R) | 10 daño, cadencia 0.18 s, cargador 12, recarga 1.3 s | +daño, +cargador, perfora, nivel 5: 2 balas |
| **Escoba** (inicial, respaldo sin munición) | Golpe en arco hacia donde se apunta | 10 daño, cd 0.75 s, arco 95°, 65 px (Hito 7) | +daño, +arco y alcance, +cadencia, nivel 5: ambos lados |
| **Escopeta** (Hito 9) | Ráfaga de perdigones en cono, cargador y reserva propios | ver Hito 9 | ver Hito 9 |

**Automáticas** (disparan solas; se obtienen al subir de nivel):

| Arma | Comportamiento | Nivel 1 | Mejoras por nivel |
|---|---|---|---|
| **Latas de conserva** | Proyectil lanzado al enemigo más cercano | 8 daño, cd 0.9 s | +proyectiles, +daño, perfora enemigos |
| **Bolsas de hielo** | Orbitan al jugador y dañan al contacto, ralentizan | 6 daño, 2 bolsas | +bolsas, +radio, +velocidad |
| **Aerosol insecticida** | Cono de gas frente al jugador, daño en el tiempo | 4 daño/0.25 s, 1.5 s activo, cd 3 s | +alcance, +duración, aplica veneno |
| **Microondas** | Se coloca en el suelo 8 s y dispara rayos a enemigos cercanos | 7 daño, cd 0.7 s | +rayos, +duración, nivel 5: 2 microondas |

### 5.5 Pasivos

| Pasivo | Efecto por nivel (máx. 5) |
|---|---|
| **Zapatillas antideslizantes** | +8% velocidad de movimiento |
| **Café de máquina** | -8% cooldown de todas las armas |
| **Imán de heladera** | +20% radio de recogida |
| **Chaleco reflectante** | -1 daño recibido por golpe (mínimo 1) |
| **Termo con sopa** | +0.5 vida/s de regeneración |
| **Calculadora del jefe** | +10% daño de todas las armas |

El Café de máquina acelera la cadencia y el golpe de las armas manuales (no la recarga) y la Calculadora del jefe
afecta a todas las armas, manuales y automáticas.

### 5.6 Enemigos (los zombis tienen oficio)

| Enemigo | Rol | Vida | Vel. | Daño | Comportamiento | Aparece desde |
|---|---|---|---|---|---|---|
| **Zombi Cliente** | Básico | 20 | 55 | 6 | Persigue al jugador | 0:00 |
| **Zombi Repartidor** | Rápido y frágil | 12 | 130 | 4 | Persigue en zigzag, aparece en grupos | 1:30 |
| **Zombi Congelado** | Tanque | 90 | 35 | 12 | Persigue lento, deja charco que ralentiza al jugador | 3:00 |
| **Zombi Carrito** | Embestida | 45 | 50 | 15 | Se detiene 0.6 s (telegrafiado con línea roja) y embiste en línea recta | 4:30 |
| **Zombi Cajero** | A distancia | 30 | 45 | 8 | Mantiene distancia y lanza recibos explosivos | 6:00 |
| **Gerente Zombi** (jefe) | Jefe | 1500 | 60 | 20 | Persigue, invoca 6 zombis cliente cada 10 s, onda expansiva cada 6 s | 5:00 y 9:00 (más fuerte) |

- La vida y el daño de los enemigos escalan un 8% por minuto.
- Al derrotar al jefe suelta un cofre: da una mejora gratis de nivel de arma.
- Límite duro de **400 enemigos** simultáneos (el spawner se frena al llegar).

### 5.7 Oleadas (`src/data/waves.ts`)

El spawner lee una tabla por minuto: `{ minute, enemyId, spawnPerSecond, groupSize }`.
Ejemplo orientativo (ajustar al probar):

- Min 0-1: Cliente, 1.0/s
- Min 1-3: Cliente 1.5/s + Repartidor en grupos de 5 cada 8 s
- Min 3-5: + Congelado 0.2/s
- Min 5: Gerente Zombi (jefe 1)
- Min 5-8: + Carrito 0.3/s, más densidad
- Min 8-10: todo lo anterior, jefe 2 al minuto 9, enjambre final (el Cajero entra desde las 6:00, ver 5.6)

Los enemigos aparecen en un anillo fuera de la pantalla alrededor del jugador.

### 5.8 Feedback visual y de sonido (importante para que "se sienta bien")

- Números de daño flotantes, destello blanco al recibir golpe, retroceso breve del enemigo.
- Partículas al morir un zombi (manchas verdes) con límite de partículas.
- Screen shake leve al recibir daño y fuerte con el jefe.
- Oscuridad ambiental que se aclara hacia las 6 AM: capa oscura con "linterna" alrededor del jugador al inicio
  que se desvanece con el reloj (efecto barato con gradiente radial).
- Sonidos sintetizados: golpe, lata, recoger cupón, subir de nivel, daño recibido, muerte del jefe, jingle de victoria.
  Con botón de silenciar (guardado en ajustes).

### 5.9 UI

- **Menú principal:** título, botón Jugar, mejor hora alcanzada, botón silencio.
- **HUD:** barra de vida, barra de XP con nivel, reloj del turno, contador de kills, iconos de armas/pasivos equipados.
- **Pausa** con Esc/P y al perder foco la pestaña.
- **Pantallas de fin:** victoria y derrota con estadísticas y botón "Reintentar".

## 6. Persistencia

`localStorage` con clave `deadshift:v1`: mejor tiempo sobrevivido, total de kills, ajustes de sonido y (desde el Hito 7)
la preferencia de mostrar el overlay de debug.
Debe tolerar datos corruptos o ausentes (try/catch y valores por defecto).

## 7. Rendimiento y calidad

- Meta: **60 FPS con 300 enemigos y 150 proyectiles** en un laptop normal.
- El canvas se ajusta al tamaño de ventana y respeta `devicePixelRatio`.
- Funciona con teclado y con táctil. Sin dependencias de hover.
- No usar `localStorage`/audio antes de una interacción del usuario cuando el navegador lo restrinja.

## 8. Hitos (implementa UNO a la vez, en orden)

**Estado actual:** Hitos 1 a 7 (incluido el 4.5) completados; 1 a 6 publicados en GitHub Pages. Siguiente: Hito 8.
Actualiza esta línea al cerrar cada hito.

Al terminar cada hito: corre `npm run lint && npm run test && npm run build`, ejecuta el juego, verifica
los criterios y detente. **NO hagas `git add`, `commit` ni `push`: el usuario hace los commits.** Sugiere un mensaje de
commit al final. **No pases al siguiente hito sin cumplir los criterios del actual.**
El workflow de despliegue corre lint, tests y build antes de publicar, así que un test roto bloquea el deploy.

### Hito 1 — Esqueleto jugable
- Proyecto Vite+TS configurado, estructura de carpetas, loop de timestep fijo, input, cámara, piso con tiles.
- Jugador que se mueve, HUD básico con vida.
- **Listo cuando:** abres `npm run dev`, mueves al jugador con WASD y táctil, la cámara lo sigue y hay 60 FPS.

### Hito 2 — Zombis y combate base
- Pools, spatial hash, Zombi Cliente persiguiendo, spawner por anillo, Escoba automática, daño y muerte con partículas.
- El jugador recibe daño y puede morir (pantalla de derrota con Reintentar).
- **Listo cuando:** puedes sobrevivir un rato matando zombis y morir, con 200+ enemigos sin bajar de 60 FPS. Tests de colisión y daño.

### Hito 3 — Progresión
- Cupones de XP, curva de niveles, pantalla de 3 mejoras, sistema de armas con niveles 1-5, los 6 armas y los 6 pasivos de `data/`.
- **Listo cuando:** puedes construir una build distinta cada partida. Tests de `progression` y de ofertas de mejoras sin duplicados inválidos.

### Hito 4 — Variedad de enemigos y jefe
- Los 5 enemigos restantes con sus comportamientos, tabla de oleadas completa, Gerente Zombi con sus habilidades y cofre.
- Reloj de 10 min con cambio de iluminación y pantalla de victoria a las 6 AM.
- **Listo cuando:** una partida completa de 10 minutos es posible, ganable y dura lo esperado. Test del spawner (determinista con semilla).

### Hito 4.5 — Control manual: pistola con munición y escoba de respaldo
- Dos armas manuales del jugador: Pistola de etiquetas (primaria) y Escoba (respaldo cuerpo a cuerpo).
- Apuntado con el mouse (en táctil: segundo joystick; disparo automático mientras se mantiene apuntando). Disparo con clic mantenido.
- Pistola: cargador, munición de reserva, recarga con R y recarga automática al vaciar el cargador si hay reserva.
- Escoba: sin munición, golpe en arco hacia donde se apunta, clic para golpear.
- Cambio automático a la escoba cuando cargador y reserva están en 0; vuelta automática a la pistola al recoger munición.
- Cambio manual con Q o rueda del mouse (en táctil: botón de cambio).
- Cajas de munición como pickup que sueltan los zombis con probabilidad definida en data/.
- La Escoba deja de ser arma automática; el resto de armas (latas, bolsas de hielo, aerosol, microondas) siguen automáticas y se obtienen al subir de nivel.
- HUD: arma activa, munición (cargador/reserva), barra de recarga y cooldown de las armas automáticas.
- Todos los números (daño, cadencia, cargador, reserva, recarga, drop de munición) en src/data/weapons.ts, sin números mágicos.
- Listo cuando: se puede jugar y ganar una partida completa con pistola y escoba, el cambio automático funciona, hay tests de munición, recarga y cambio de arma, y el balance es razonable.

### Hito 5 — Pulido
- Sonidos WebAudio, números de daño, screen shake, menú principal, pausa, guardado de récords, botón de silencio.
- **Listo cuando:** se siente bien jugarlo, no hay errores en consola y los récords persisten al recargar.

### Hito 6 — Entrega
- `npm run build` limpio, `dist/` probado con `npm run preview`, `README.md` con cómo jugar, controles y cómo desplegar
  en GitHub Pages / itch.io / Netlify (incluye el workflow de GitHub Actions para Pages).
- Favicon, título y meta tags, pantalla de carga si hace falta.
- **Listo cuando:** la carpeta `dist/` se puede subir tal cual y funciona.

### Hito 7 — Debug, balance y pickups pendientes
- Overlay de debug (FPS, ms de CPU, zombis, bajas) oculto por defecto. **F3** lo alterna en partida normal, sin saltarse el menú.
  `?debug` lo activa al inicio.
- Casilla "Mostrar FPS y métricas" en el panel de pausa (para táctil). Se guarda en `deadshift:v1` como campo `showDebug`,
  validado campo por campo como el resto del guardado.
- `docs/DEBUG.md` con todos los parámetros de URL (`?spawn`, `?god`, `?debug`, `?weapons=all`, `?t`, `?ammo`) y teclas de depuración.
  Mencionar F3 en el panel de controles.
- Balance: la Escoba es demasiado fuerte. Medir con `BALANCE=1 npx vitest run tests/balance.test.ts` antes y después.
  Agregar al dataset de debug las bajas por arma. Probar palancas (cooldown, alcance, daño, empuje) y reportar una tabla
  antes/después en `DECISIONS.md`. La Pistola debe ser claramente útil, no opcional.
- Botiquín (cura 25 % de vida, caída rara de enemigos élite) e Imán de suelo (caída muy rara, atrae todos los cupones).
  Pool propio, reutilizando el imantado existente. Valores en `data/`. Eran pendientes desde el Hito 3.
- **Listo cuando:** F3 y la casilla funcionan, el overlay oculto no consume CPU, el balance queda documentado con números
  y los pickups nuevos tienen tests.

### Hito 8 — Estantes sólidos
- Las góndolas colisionan con el jugador y los zombis. La colisión se deriva de la misma función `hash2` que las genera
  (sin guardar estado) y solo consulta los bloques cercanos a cada entidad.
- Los zombis hoy persiguen en línea recta y se van a atascar: deben deslizarse por el borde del estante y, si no progresan
  durante ~1.5 s, reubicarse en el anillo de spawn. El Carrito no debe embestir indefinidamente contra un estante.
- Los estantes **bloquean** proyectiles enemigos (recibos del Cajero) y las balas del jugador. **No bloquean:** barridos de la
  Escoba, la onda del jefe, el aerosol, las bolsas de hielo ni el imantado de pickups.
- Spawner, invocaciones del jefe, microondas y cofres nunca aparecen dentro de un estante. Mati no empieza atrapado y, si
  queda superpuesto por algún motivo, se expulsa al borde libre más cercano.
- Garantizar pasillos de al menos 80 px entre estantes para que nunca haya callejones sin salida (reducir la probabilidad
  de góndola o ajustar sus largos en `data/render.ts`).
- Aspecto claramente sólido (sombra y altura) para distinguirlos del decorado.
- **Listo cuando:** no quedan zombis atascados en una partida completa, 60 FPS con 300 enemigos, y hay tests de colisión
  círculo-rectángulo, determinismo del layout y validez de spawns.

### Hito 9 — Escopeta y mods de pistola
- Escopeta como tercera arma manual en `player.manual`: 5 perdigones en cono (±15°), 6 de daño cada uno, alcance efectivo
  ~220 px, cadencia 0.9 s, cargador 6, reserva propia (tope 36), recarga 2 s, empuje fuerte. Niveles 1-5 en `data/weapons.ts`.
- Se obtiene como arma nueva en las ofertas de nivel (desde el nivel 4) y como opción garantizada en el cofre del primer jefe.
  Es la única arma manual que puede salir como "arma nueva".
- Cambio de arma con 3 armas: Q o rueda ciclan, las teclas 1/2/3 seleccionan (se descartan mientras hay un menú abierto),
  el botón táctil cicla. El cambio automático pasa a la siguiente arma con munición, con la Escoba como último respaldo;
  se conserva la lógica de `autoSwitched`.
- Cajas de cartuchos de color distinto, con pool propio. Solo caen si el jugador ya tiene la escopeta, repartiendo la
  probabilidad de caída entre tipos de munición.
- Mods de pistola (no suben nivel ni ocupan slots), ofrecidos desde la Pistola nivel 3 y con máximo 2 por partida:
  perforante, cargador extendido, balas incendiarias (daño en el tiempo reutilizando el sistema del aerosol) y balas con rebote.
- HUD y pantalla de mejora actualizados. `?weapons=all` incluye la escopeta.
- **Listo cuando:** se puede jugar y ganar usando las tres armas manuales, el cambio automático funciona con las tres y hay
  tests de munición, recarga, cambio de arma y mods.

### Hito 10 — Evoluciones de armas
- Receta = arma en nivel 5 + pasivo específico en nivel 3 o más. La evolución reemplaza al arma base en su slot
  (o en su lugar manual).
- Se ofrece como opción especial en el cofre del jefe y también en la pantalla de nivel cuando se cumple la receta
  (con solo 2 cofres por partida, si no, casi nunca se vería).
- Recetas como datos en `src/data/evolutions.ts` (con 7 armas y 6 pasivos, el Chaleco se comparte):
  - Escoba + Imán de heladera → **Escoba eléctrica** (descarga que salta entre zombis)
  - Pistola + Calculadora del jefe → **Pistola láser** (perfora todo, cadencia alta)
  - Escopeta + Chaleco reflectante → **Escopeta antidisturbios** (empuje masivo, perdigones perforantes)
  - Latas + Café de máquina → **Latas granada** (explotan al impactar)
  - Aerosol + Termo con sopa → **Lanzallamas casero**
  - Bolsas de hielo + Zapatillas → **Ventisca** (más radio, congela)
  - Microondas + Chaleco reflectante → **Microondas industrial**
- La pantalla de mejora muestra la receta y qué falta para cumplirla. HUD con ícono distinto para el arma evolucionada.
- **Listo cuando:** las 7 evoluciones funcionan, hay tests de condiciones de evolución y de slots, y una partida con
  evolución se mantiene a 60 FPS.

### Ideas de expansión (NO implementar hasta que se pida)
- Más personajes con stats distintos (Guardia de seguridad, Pastelera).
- Meta-progresión: monedas entre partidas para mejoras permanentes.
- Modo infinito, modo diario con semilla del día, ranking online.
- Nuevos mapas (depósito, estacionamiento, panadería).

## 9. Cómo trabajar conmigo (instrucciones para Claude Code)

1. **Empieza en modo plan.** Antes de escribir código del hito, resume qué vas a hacer y qué archivos tocarás.
2. Implementa solo el hito actual. No adelantes funcionalidades de hitos futuros.
3. Después de cada cambio importante: ejecuta lint, tests y build. Corrige los errores tú mismo antes de seguir.
4. Verifica el juego de verdad: levanta el servidor de desarrollo y revisa que la consola no tenga errores.
   Si tienes forma de abrir el navegador o tomar capturas, úsala.
5. Escribe tests para toda la lógica pura (progresión, spawner, daño, RNG, persistencia). No testees el render.
6. No ejecutes `git add`, `git commit`, `git push` ni ningún comando que modifique el historial o los remotos.
   Al terminar cada hito, sugiere un mensaje de commit y deja que el usuario lo haga.
7. Al terminar cada hito, entrega un resumen corto: qué se hizo, cómo probarlo y qué sigue.
8. Si hay una decisión de diseño ambigua, elige la opción más simple y regístrala en `docs/DECISIONS.md`.
9. No agregues dependencias de runtime sin preguntarme.
10. Mantén los balances en `src/data/`, nunca números mágicos dispersos en el código.
11. Antes de planificar cada hito, lee `docs/DECISIONS.md`. Al terminar, agrega una sección del hito y marca con tachado
    las decisiones anteriores que reemplaces. Actualiza la línea "Estado actual" del §8.
12. No crear archivos `.env` ni guardar claves, tokens o contraseñas en el proyecto. El juego no usa APIs externas.
13. Si cambias el diseño de algo que este archivo describe (controles, armas, mapa), actualiza también la sección
    correspondiente de este archivo para que no se contradiga con `DECISIONS.md`.

## 10. Definición de "terminado"

- `npm run lint`, `npm run test` y `npm run build` pasan sin errores ni warnings.
- Una partida completa (10 min) se puede jugar y ganar en desktop y móvil.
- Sin errores en consola.
- `dist/` funciona abriéndolo desde cualquier hosting estático.
- README con instrucciones claras de juego y despliegue.