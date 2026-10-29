# DEAD SHIFT — Survivor-like zombi en un supermercado 24h

Eres el repositor del turno de noche. A las 10 PM se apagan las luces y los clientes
se levantan... distintos. Sobrevive hasta las 6 AM usando lo que encuentres en las góndolas.

Este archivo es la fuente de verdad del proyecto. Léelo completo antes de escribir código.
Si algo no está especificado, decide lo más simple que funcione y anótalo en `docs/DECISIONS.md`.

---

## 1. Objetivo y alcance

- Juego 2D top-down, estilo Vampire Survivors: el jugador se mueve, las armas disparan solas,
  los enemigos llegan en oleadas, se sube de nivel y se eligen mejoras.
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
    pickups.ts           # cupones (XP), botiquines, imán
    spawner.ts           # oleadas según el reloj
    progression.ts       # XP, niveles, ofertas de mejoras
    systems/             # un archivo por sistema: movement, collision, damage, ...
  data/
    weapons.ts           # definiciones de armas y niveles 1-5
    enemies.ts           # definiciones de enemigos
    upgrades.ts          # pasivos
    waves.ts             # tabla de oleadas por minuto
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
docs/DECISIONS.md        # decisiones de diseño tomadas durante el desarrollo
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
- Mapa: arena infinita (el mundo se repite con tiles de piso de supermercado: baldosas claras con líneas, góndolas decorativas
  sin colisión como fondo). Sin límites; la cámara sigue al jugador.

### 5.2 Jugador: "Mati, el repositor"

| Stat | Valor base |
|---|---|
| Vida | 100 |
| Velocidad | 150 px/s |
| Radio de recogida | 60 px |
| Invulnerabilidad tras golpe | 0.5 s |

- Movimiento con WASD/flechas o joystick virtual en pantalla táctil.
- Las armas disparan automáticamente. El jugador mira hacia donde se mueve.
- Slots: máximo **4 armas** y **4 pasivos**.
- Empieza con la **Escoba**.

### 5.3 Experiencia y niveles

- Los zombis sueltan **cupones** (gemas de XP; 1, 5 y 20 de valor según el enemigo).
- Curva de XP para subir al nivel N: `5 + N * 4 + floor(N^1.5)`.
- Al subir de nivel: el juego se pausa y se ofrecen **3 opciones al azar** (nueva arma, mejorar arma, pasivo, o curar 30% si no hay nada).
- Botón "Reroll" 1 vez por partida (se amplía luego).

### 5.4 Armas (cada una con niveles 1 a 5)

| Arma | Comportamiento | Nivel 1 | Mejoras por nivel |
|---|---|---|---|
| **Escoba** (inicial) | Barrido en arco frente al jugador, golpea a todos en el arco | 10 daño, cd 1.2 s, arco 100° | +daño, +arco, nivel 5: barre ambos lados |
| **Latas de conserva** | Proyectil lanzado al enemigo más cercano | 8 daño, cd 0.9 s | +proyectiles, +daño, perfora enemigos |
| **Bolsas de hielo** | Orbitan al jugador y dañan al contacto, ralentizan | 6 daño, 2 bolsas | +bolsas, +radio, +velocidad |
| **Aerosol insecticida** | Cono de gas frente al jugador, daño en el tiempo | 4 daño/0.25 s, 1.5 s activo, cd 3 s | +alcance, +duración, aplica veneno |
| **Microondas** | Se coloca en el suelo 8 s y dispara rayos a enemigos cercanos | 7 daño, cd 0.7 s | +rayos, +duración, nivel 5: 2 microondas |
| **Pistola de etiquetas** | Ráfaga rápida de balas pequeñas en dirección del movimiento | 3 daño, cd 0.15 s | +cadencia, +daño, +dispersión controlada |

### 5.5 Pasivos

| Pasivo | Efecto por nivel (máx. 5) |
|---|---|
| **Zapatillas antideslizantes** | +8% velocidad de movimiento |
| **Café de máquina** | -8% cooldown de todas las armas |
| **Imán de heladera** | +20% radio de recogida |
| **Chaleco reflectante** | -1 daño recibido por golpe (mínimo 1) |
| **Termo con sopa** | +0.5 vida/s de regeneración |
| **Calculadora del jefe** | +10% daño de todas las armas |

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
- Min 8-10: todo lo anterior, +Cajero, jefe 2 al minuto 9, enjambre final

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

`localStorage` con clave `deadshift:v1`: mejor tiempo sobrevivido, total de kills, ajustes de sonido.
Debe tolerar datos corruptos o ausentes (try/catch y valores por defecto).

## 7. Rendimiento y calidad

- Meta: **60 FPS con 300 enemigos y 150 proyectiles** en un laptop normal.
- El canvas se ajusta al tamaño de ventana y respeta `devicePixelRatio`.
- Funciona con teclado y con táctil. Sin dependencias de hover.
- No usar `localStorage`/audio antes de una interacción del usuario cuando el navegador lo restrinja.

## 8. Hitos (implementa UNO a la vez, en orden)

Al terminar cada hito: corre `npm run lint && npm run test && npm run build`, ejecuta el juego, verifica
los criterios y haz un commit con mensaje claro. **No pases al siguiente hito sin cumplir los criterios del actual.**

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
- El Escoba deja de ser arma automática; el resto de armas (latas, bolsas de hielo, aerosol, microondas) siguen automáticas y se obtienen al subir de nivel.
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

### Ideas de expansión (NO implementar hasta que se pida)
- Evoluciones de armas (ej. Escoba + Imán = Escoba eléctrica).
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
6. Haz commits pequeños y descriptivos por hito (o por sub-tarea grande).
7. Al terminar cada hito, entrega un resumen corto: qué se hizo, cómo probarlo y qué sigue.
8. Si hay una decisión de diseño ambigua, elige la opción más simple y regístrala en `docs/DECISIONS.md`.
9. No agregues dependencias de runtime sin preguntarme.
10. Mantén los balances en `src/data/`, nunca números mágicos dispersos en el código.

## 10. Definición de "terminado"

- `npm run lint`, `npm run test` y `npm run build` pasan sin errores ni warnings.
- Una partida completa (10 min) se puede jugar y ganar en desktop y móvil.
- Sin errores en consola.
- `dist/` funciona abriéndolo desde cualquier hosting estático.
- README con instrucciones claras de juego y despliegue.
