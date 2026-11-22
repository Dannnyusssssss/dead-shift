# Arquitectura

## Visión general

Dead Shift es un survivor-like 2D visto desde arriba, para navegador de escritorio y celular. Se escribe en
TypeScript estricto, se dibuja con Canvas 2D y se empaqueta con Vite como un sitio estático. No tiene dependencias de
runtime, no usa motores de juego ni frameworks de interfaz, y no hace peticiones de red: los gráficos se dibujan por
código y el sonido se sintetiza con WebAudio.

La idea central es separar **qué pasa** (el estado y las reglas de la partida) de **cómo se ve y se oye** (dibujo,
interfaz y sonido). Así la lógica se prueba sin navegador y el aspecto cambia sin tocar las reglas.

## Mapa de carpetas

```
src/
  main.ts        punto de entrada: conecta bucle, entrada, estado, dibujo, interfaz y guardado
  core/          piezas genéricas: bucle de paso fijo, entrada, cámara, matemática, RNG, pools, rejilla espacial
  data/          contenido y balance: armas, enemigos, mejoras, oleadas, dificultades, textos, constantes
  game/          estado y reglas de la partida (sin DOM ni canvas)
  game/systems/  sistemas del mundo: movimiento, colisión, daño, muerte, estados, góndolas
  render/        dibujo del mundo, HUD, iluminación, partículas y números flotantes
  ui/            menús y pantallas en DOM, controles táctiles, estilos
  audio/         efectos sintetizados con WebAudio
  save/          lectura y escritura validada de localStorage
tests/           tests de la lógica pura (Vitest)
public/          favicon
docs/            documentación pública
```

## Capas

```
  entrada (teclado, mouse, táctil)
            |
            v
  core/loop --(paso fijo, 60 Hz)--> game/ updateWorld --> estado (World)
            |                                                 |
            |                                                 v
            +--(cada frame, interpolado)--> render/ --> canvas
                                            ui/ y audio/ <-- eventos del juego
                                            save/ <-- fin de partida
```

- **`game/`** contiene el estado (`World`) y las reglas. No toca canvas ni DOM, así que es determinista y se prueba
  con Vitest en Node. Emite eventos (`src/game/events.ts`) que el resto del programa traduce en sonido, partículas y
  texto.
- **`render/`** solo lee el estado y dibuja; nunca lo modifica. Recibe además la fracción entre dos pasos de
  simulación para interpolar posiciones y que el movimiento sea fluido en pantallas de cualquier frecuencia.
- **`ui/`** son los menús, la pantalla de subida de nivel y los controles táctiles, hechos con DOM.
- **`save/`** es la única capa que habla con `localStorage`. Valida cada campo al leer y escribe solo los campos
  conocidos.
- **`data/`** es solo datos: las cifras de balance no se escriben en los sistemas. Los textos visibles en español
  viven en `src/data/texts.ts`; el código está en inglés.
- **`core/`** no conoce el juego: bucle, RNG, pools y rejilla espacial son piezas reutilizables.

## Flujo del bucle

`createFixedLoop` (`src/core/loop.ts`) acumula el tiempo real de cada frame del navegador y ejecuta la simulación en
pasos fijos de 1/60 s; el tiempo acumulado por frame tiene un tope para no encadenar demasiados pasos tras una pausa
larga. En cada paso, `updateWorld` (`src/game/world.ts`) recorre una lista ordenada de sistemas:

1. Frenesí de la madrugada y reloj del turno.
2. Movimiento del jugador.
3. Oleadas y aparición de enemigos.
4. Comportamiento y movimiento de enemigos; estados (ralentización, fuego, etc.).
5. Índice espacial, separación entre zombis y colisión con góndolas.
6. Armas manuales y automáticas, torretas, proyectiles, zonas peligrosas y arcos.
7. Daño por contacto, muertes, recolección, progresión y temporizadores.

El orden se declara en un solo lugar (`SYSTEMS` en `world.ts`) para que sea explícito. Tras los pasos que toquen en
ese frame, `main.ts` dibuja con el estado y la fracción de interpolación.

## Decisiones de diseño

- **Basado en datos.** Armas, enemigos, mejoras, oleadas, dificultades y evoluciones se describen en `src/data/`. Los
  sistemas leen esas tablas y no llevan cifras propias.
- **Aleatoriedad con semilla.** Todo el azar pasa por `src/core/rng.ts`, un generador con semilla. Una partida con la
  misma semilla y las mismas entradas se repite igual, lo que hace reproducibles los tests y el balance.
- **Pools y rejilla espacial.** Zombis, proyectiles, partículas y recogibles reutilizan objetos (`src/core/pool.ts`)
  para no generar basura en el bucle caliente. Las consultas de vecinos usan una rejilla espacial
  (`src/core/spatial-hash.ts`) en lugar de comparar todos contra todos.
- **Sin dependencias ni red.** Reduce la superficie de ataque y de mantenimiento, y permite desplegar la carpeta
  `dist/` en cualquier hosting estático. Al compilar, `vite.config.ts` añade a `index.html` una política de seguridad
  de contenido (CSP) que solo permite los archivos del propio sitio.
- **Guardado mínimo y validado.** Solo se guardan ajustes y récords (`src/save/storage.ts`, clave `deadshift:v1`). Los
  parámetros de la URL se interpretan en un módulo puro (`src/game/debug-options.ts`) y las partidas con ayudas que
  alteran el juego no registran récords.
- **Accesibilidad.** Ningún aviso parpadea más de 3 veces por segundo y ninguno se apaga del todo: se desvanecen con
  suavidad (`PULSE` en `src/data/render.ts`). El ajuste «Reducir movimiento» quita el temblor de cámara y deja esos
  avisos fijos; su valor inicial sigue la preferencia del sistema (`prefers-reduced-motion`).

## Cómo se prueba

Los tests (`tests/`, Vitest, entorno Node) cubren la lógica pura: matemática, RNG, pools, rejilla espacial, bucle,
colisiones, daño, armas, evoluciones, dificultades, progresión, guardado y formato de texto. No se prueban el dibujo
ni el audio real. `npm run lint` ejecuta ESLint, `npm run test` los tests y `npm run build` comprueba tipos y compila.
El workflow de despliegue (`.github/workflows/deploy.yml`) ejecuta las tres cosas antes de publicar.

## Cómo se agrega una pieza

- **Un arma automática con un comportamiento existente** (proyectil, órbita, cono o torreta): se añade su
  identificador y su definición por niveles en `src/data/weapons.ts`, su texto en `src/data/texts.ts` y, si procede,
  su evolución en `src/data/evolutions.ts`. Los sistemas la toman de las tablas.
- **Un comportamiento de arma nuevo:** además del dato, se añade un sistema en `src/game/` y se registra en la lista
  `SYSTEMS` de `world.ts`, con sus tests.
- **Un enemigo:** se agrega a `src/data/enemies.ts` (vida, velocidad, daño, aspecto y comportamiento) y a las oleadas
  en `src/data/waves.ts`. Si usa un comportamiento nuevo, se implementa en `src/game/enemies.ts`.
- **Una dificultad o una mejora:** `src/data/difficulty.ts` y `src/data/upgrades.ts`.

## Límites conocidos

- El mundo es un único mapa fijo (`src/data/map.ts`); no hay generación de niveles.
- El rendimiento depende del dispositivo y del navegador. El diseño busca mantener la fluidez con cientos de
  enemigos, pero esa fluidez no se ha medido en todos los dispositivos.
- Los récords viven en el navegador del jugador: no hay clasificación en línea ni sincronización entre dispositivos.
- El audio se sintetiza en vivo, por lo que el resultado puede variar entre navegadores.
