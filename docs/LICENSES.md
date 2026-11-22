# Licencias

Última revisión: 2026-11-21.

## Recursos del juego

El juego publicado no incluye recursos de terceros:

- **Gráficos:** todo se dibuja por código con Canvas 2D (personajes, góndolas, partículas, iluminación e interfaz del
  mundo). No hay imágenes ni sprites externos. El único archivo gráfico del sitio es `public/favicon.svg`.
- **Sonido:** todos los efectos se sintetizan en tiempo real con WebAudio. No hay archivos de audio.
- **Fuentes tipográficas:** no se empaqueta ninguna. El texto usa las fuentes del sistema del jugador, y los emojis
  de la interfaz los dibuja el sistema del jugador con sus propias fuentes.
- **Código en tiempo de ejecución:** el juego no tiene dependencias de runtime. Lo que se publica es código propio
  compilado.

El código y el contenido propios son de Danny Sivinta, con todos los derechos reservados (ver [LICENSE](../LICENSE)).

## Herramientas de desarrollo

Se usan solo para escribir, comprobar y compilar el proyecto. **No se incluyen en el juego publicado** ni se
redistribuyen con él. Versiones según `package-lock.json`.

| Herramienta            | Versión | Licencia   | Uso                                   |
| ---------------------- | ------- | ---------- | ------------------------------------- |
| vite                   | 8.3.5   | MIT        | Servidor de desarrollo y build        |
| vitest                 | 5.0.5   | MIT        | Tests de lógica                       |
| typescript             | 6.0.3   | Apache-2.0 | Tipado estricto y compilación         |
| eslint                 | 10.15.0 | MIT        | Análisis estático                     |
| @eslint/js             | 10.0.1  | MIT        | Reglas base de ESLint                 |
| typescript-eslint      | 8.73.0  | MIT        | ESLint para TypeScript                |
| eslint-config-prettier | 10.1.8  | MIT        | Evita choques entre ESLint y Prettier |
| globals                | 17.13.0 | MIT        | Variables globales para ESLint        |
| prettier               | 3.9.10  | MIT        | Formato del código                    |

Las licencias se leyeron del campo `license` del `package.json` de cada paquete instalado. Las dependencias
indirectas de estas herramientas tienen sus propias licencias y tampoco forman parte del juego publicado.
