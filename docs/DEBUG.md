# Depuración

Herramientas para probar el juego y medir el rendimiento y el balance. Ninguna afecta a una partida normal
mientras no se activen.

## Overlay de métricas

Una línea con `FPS · ms de CPU por frame · zombis vivos · bajas`.

- Escritorio: abajo a la derecha.
- Táctil: encima del panel del arma, porque abajo a la derecha están los botones "Cambiar arma" y "Recargar".

Hay tres formas de mostrarla:

| Cómo                                             | Dónde funciona              | ¿Se guarda?                        |
| ------------------------------------------------ | --------------------------- | ---------------------------------- |
| **F3**                                           | Menú, partida y pausa       | Sí (`showDebug` en `deadshift:v1`) |
| Casilla **"Mostrar FPS y métricas"** en la pausa | Pausa (pensada para táctil) | Sí (el mismo campo `showDebug`)    |
| Parámetro `?debug` (o cualquier otro de abajo)   | Toda la sesión              | No: solo esa carga de la página    |

- F3 y la casilla nunca inician la partida ni saltan el menú.
- Con un parámetro de URL activo, F3 y la casilla no pueden ocultarla.
- Oculta, no se mide nada: no se llama a `performance.now()` por frame, no se arma el texto y no se publica el dataset.

## Parámetros de URL

Se agregan a la dirección, por ejemplo `http://localhost:5173/?god&spawn=200`. Se pueden combinar.
**Cualquiera de ellos salta el menú principal**, muestra el overlay y publica el dataset (ver abajo).

| Parámetro      | Efecto                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| `?debug`       | Solo el overlay y el dataset                                                                  |
| `?god`         | Mati recibe los golpes (parpadea, suena) pero no pierde vida                                  |
| `?spawn=N`     | Empieza con una horda de N zombis alrededor (tope 400)                                        |
| `?t=S`         | Adelanta el reloj S segundos (máx. 599). Los jefes cuyo momento ya pasó no aparecen           |
| `?weapons=all` | Las 4 automáticas y las 2 manuales en nivel 5, con la reserva llena (ignora el tope de slots) |
| `?ammo=N`      | Cargador vacío y N balas de reserva (`?ammo=0` arranca directo en la Escoba)                  |

Ejemplos útiles:

- `?spawn=300&god`: prueba de rendimiento (meta: 60 FPS con 300 zombis).
- `?t=299&god`: llega el primer jefe.
- `?t=590`: amanecer y pantalla de victoria en 10 s.
- `?ammo=0&god`: jugar solo con la Escoba.

## Teclas

| Tecla | Efecto                                   |
| ----- | ---------------------------------------- |
| F3    | Mostrar / ocultar el overlay de métricas |
| M     | Silencio (funciona también en los menús) |
| Esc/P | Pausa                                    |

## Dataset para pruebas automáticas

Con el overlay visible, cada 500 ms se publica el estado en `document.body.dataset`, para leerlo desde un navegador
headless (`document.body.dataset.fps`, etc.):

| Clave                                         | Contenido                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `fps`, `cpu`                                  | FPS y ms de CPU por frame (promedio de 0.5 s)                              |
| `enemies`                                     | Zombis vivos                                                               |
| `kills`                                       | Bajas de la partida                                                        |
| `weaponKills`                                 | Bajas por arma en JSON, solo las que tienen alguna (`{"labelGun":40,...}`) |
| `level`, `hp`                                 | Nivel y vida de Mati                                                       |
| `status`                                      | `playing`, `levelup`, `dead`, `won` o `paused`                             |
| `time`, `clock`                               | Segundos de partida y hora del turno                                       |
| `loadout`                                     | Armas automáticas y pasivos con su nivel (`cans:2,coffee:1`)               |
| `kinds`                                       | Zombis por tipo en JSON (más `aiming`: carritos apuntando)                 |
| `hazards`, `hazardKinds`                      | Peligros activos (charcos, recibos, ondas)                                 |
| `chests`, `ammoBoxes`, `floorItems`           | Cofres, cajas de munición y botiquines / imanes en el suelo                |
| `active`, `ammo`, `reloading`, `manualLevels` | Arma manual activa, `cargador/reserva`, recarga, niveles `pistola/escoba`  |
| `trauma`                                      | Pico de screen shake desde la publicación anterior                         |
| `muted`, `showDebug`                          | Ajustes guardados                                                          |

## Reporte de balance

```bash
BALANCE=1 npx vitest run tests/balance.test.ts
```

En PowerShell: `$env:BALANCE=1; npx vitest run tests/balance.test.ts; Remove-Item Env:BALANCE`.

No corre con `npm run test`. Juega partidas reales (sin `?god`) con el bot de `tests/helpers.ts` en 12 semillas
y tres escenarios, cada uno con y sin armas automáticas:

- `mixed`: la Pistola como arma principal y la Escoba de respaldo (juego normal).
- `broomOnly`: sin balas ni cajas de munición, solo la Escoba.
- `gunOnly`: la Pistola con reserva infinita y nunca la Escoba (poder puro de la Pistola).

Imprime por escenario el tiempo sobrevivido, las bajas por minuto (`kpm`), la parte de las bajas manuales que hizo la
Escoba y, por semilla, las bajas por arma. Los resultados del Hito 7 están en `DECISIONS.md`.
