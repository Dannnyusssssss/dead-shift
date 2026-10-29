# Dead Shift

Survivor-like de zombis en un supermercado 24 h, para jugar en el navegador (PC y celular).

Eres Mati, el repositor del turno de noche. A las 10 PM se corta la luz y los clientes se levantan… distintos.
Sobrevive hasta las **6:00 AM** con lo que encuentres en las góndolas.

- Una partida dura **10 minutos reales** (el reloj del turno avanza de 10 PM a 6 AM).
- Sin instalación, sin backend y sin assets externos: todo se dibuja con Canvas 2D y el sonido se sintetiza con WebAudio.

## Cómo jugar

- **Tus armas manuales:**
  - **Pistola de etiquetas:** tu arma principal. Tiene cargador y munición de reserva.
  - **Escoba:** el respaldo cuerpo a cuerpo; no gasta munición.
  - Si te quedas sin balas, Mati saca la escoba sola. Cuando recoges una caja de munición, vuelve a la pistola.
- **Los zombis sueltan:**
  - Cupones (experiencia).
  - A veces, cajas de munición.
- **Al subir de nivel** el juego se pausa y eliges 1 de 3 mejoras: un arma automática nueva, subir de nivel un arma
  o un pasivo. Tienes 1 "Cambiar opciones" por partida.
  - Armas automáticas: latas de conserva, bolsas de hielo, aerosol insecticida y microondas.
  - Pasivos: zapatillas, café, imán, chaleco, termo con sopa y calculadora.
- **El Gerente Zombi** (jefe) llega a las 2:00 AM y vuelve, más fuerte, a las 5:12 AM. Al vencerlo suelta un cofre
  con una mejora de arma gratis.
- **Ganas** si llegas a las 6:00 AM con vida: amanece y los zombis se desmayan. Tu mejor hora y tus bajas totales
  quedan guardadas en el navegador.

## Controles

### PC

| Acción                   | Tecla                                    |
| ------------------------ | ---------------------------------------- |
| Moverse                  | WASD o flechas                           |
| Apuntar                  | Mouse                                    |
| Disparar / golpear       | Clic izquierdo (mantenido) o Espacio     |
| Recargar                 | R                                        |
| Cambiar pistola ↔ escoba | Q o rueda del mouse                      |
| Pausa                    | Esc o P (también el botón ❚❚)            |
| Silenciar                | M                                        |
| Elegir mejora            | 1 / 2 / 3, clic; R para cambiar opciones |

Sin mouse (solo teclado), Mati apunta hacia donde camina y dispara con Espacio.

### Celular / tablet

- **Mitad izquierda:** joystick de movimiento (aparece donde apoyas el dedo).
- **Mitad derecha:** joystick de apuntado. Mientras lo empujas, Mati dispara hacia ese lado.
- **Botones:** "Cambiar arma" y "Recargar" abajo a la derecha, y pausa arriba a la derecha.
- La recarga también es automática al vaciar el cargador.
- El juego se pausa solo si cambias de app o de pestaña.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # tsc --noEmit && vite build  -> dist/
npm run preview    # sirve dist/ para probar el build
npm run test       # tests de lógica (Vitest)
npm run lint       # ESLint
```

Para probar en el celular dentro de la misma red Wi-Fi: `npm run dev -- --host` y abre la dirección "Network" que aparece.

### Parámetros de depuración

Se agregan a la URL, por ejemplo `http://localhost:5173/?god&spawn=200`. Cualquiera de ellos salta el menú y muestra
FPS, CPU y la cantidad de zombis.

| Parámetro      | Efecto                                                  |
| -------------- | ------------------------------------------------------- |
| `?debug`       | Solo las métricas                                       |
| `?god`         | Mati no pierde vida                                     |
| `?spawn=N`     | Empieza con una horda de N zombis                       |
| `?t=S`         | Adelanta el reloj S segundos (`?t=299`: llega el jefe)  |
| `?weapons=all` | Todas las armas en nivel 5                              |
| `?ammo=N`      | Cargador vacío y N balas de reserva (`0` = solo escoba) |

### Estructura

```
src/
  core/     loop de timestep fijo, input, cámara, RNG con semilla, pools, rejilla espacial
  game/     estado y sistemas de la partida (sin DOM ni canvas)
  data/     armas, enemigos, mejoras, oleadas, sonidos, textos y constantes visuales
  render/   dibujo del mundo, HUD, partículas y números de daño
  ui/       menús y pantallas en DOM
  audio/    efectos sintetizados con WebAudio
  save/     récords y ajustes en localStorage
tests/      tests de lógica pura
```

Todo el contenido vive en `src/data/`: agregar un arma o un enemigo con un comportamiento existente es tocar un solo
archivo. Las reglas del proyecto están en [`CLAUDE.md`](CLAUDE.md) y las decisiones de diseño en
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## Despliegue

`npm run build` genera `dist/`, una carpeta estática que funciona en cualquier hosting y en cualquier subruta
(`vite.config.ts` usa `base: './'`).

> Abrir `dist/index.html` con doble clic **no funciona**: los navegadores bloquean los módulos JavaScript fuera de un
> servidor (`file://`). Para probarlo en tu PC usa `npm run preview`.

### GitHub Pages (automático)

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila, corre lint y tests, y publica
`dist/` en cada push a `main`.

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions** (una sola vez).
2. Haz push a `main`. El avance se ve en la pestaña **Actions**.
3. El juego queda en `https://<usuario>.github.io/<repositorio>/`.
   Para este repo: <https://dannnyusssssss.github.io/dead-shift/>.

También se puede lanzar a mano desde **Actions → Deploy to GitHub Pages → Run workflow**.

### itch.io

1. `npm run build`.
2. Comprime el **contenido** de `dist/` en un zip, no la carpeta: `index.html` tiene que quedar en la raíz del zip.
3. En itch.io: **Create new project**.
   - **Kind of project:** HTML.
   - Sube el zip y marca **This file will be played in the browser**.
4. En **Embed options**:
   - Tamaño sugerido: 1280 × 720.
   - Activa **Mobile friendly** (orientación automática) y **Fullscreen button**.

### Netlify

- Rápido: arrastra la carpeta `dist/` a <https://app.netlify.com/drop>.
- Conectado al repo: build command `npm run build`, publish directory `dist`.

### Vercel

Importa el repo. Vercel detecta Vite solo: build command `npm run build`, output directory `dist`.
