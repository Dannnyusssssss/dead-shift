# Inventario de privacidad

Última actualización: 2026-11-27.

Responsable: Danny Sivinta, Quito, Ecuador. Contacto: cuartojuegos.contacto@gmail.com.

## Qué recolecta

Nada. Dead Shift no tiene cuentas, formularios, chat, analítica, anuncios ni cookies, y no hace peticiones de red
propias: todo el juego se ejecuta en el navegador del jugador. El proyecto no envía datos a ningún servidor.

## Qué guarda en el dispositivo

Una sola entrada de `localStorage` en el navegador del jugador, con la clave `deadshift:v1`. No sale del
dispositivo. Contiene:

| Campo                                | Para qué sirve                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `totalKills`                         | Total de bajas de todas las partidas, mostrado en el menú                                      |
| `muted`                              | Si el sonido está silenciado                                                                   |
| `showDebug`                          | Si se muestra la línea de FPS y métricas                                                       |
| `difficulty`                         | Última dificultad elegida en el menú                                                           |
| `reducedMotion`                      | Si el jugador pidió reducir el movimiento (quita el temblor de cámara)                         |
| `records`                            | Por dificultad (fácil, medio, difícil): mejor hora alcanzada (`bestTime`) y victorias (`wins`) |
| `keyBindings`                        | Tecla elegida para cada acción en el menú «Controles»                                          |
| `padBindings`                        | Botón del mando elegido para cada acción                                                       |
| `viewScale`                          | Campo de visión (cuánto del supermercado entra en pantalla)                                    |
| `touchSensitivity`, `padSensitivity` | Sensibilidad de los joysticks táctiles y de los sticks del mando (1 a 5)                       |
| `aimAssist`                          | Si el apuntado asistido está activado                                                          |
| `fireMode`                           | Si el disparo se mantiene pulsado o se activa y desactiva con cada pulsación                   |

No se guarda nombre, identificador, correo, ubicación ni ningún dato que identifique a una persona. Los valores se
validan campo por campo al leerlos; un dato dañado o ajeno se descarta y se usa el valor por defecto.

Para funcionar, el juego lee en el momento el estado del mando conectado (botones y sticks) y, donde el navegador lo
permite, la distribución del teclado (para mostrar el nombre real de cada tecla). El nombre y el modelo del mando y la
distribución del teclado no se guardan ni salen del dispositivo.

## Cuánto se conserva y cómo borrarlo

Se conserva hasta que el jugador lo borre. Hay dos formas:

- El botón **«Borrar datos guardados»** del menú, con confirmación. Borra únicamente la clave `deadshift:v1` de este
  navegador.
- Borrar los datos del sitio desde la configuración del navegador.

## Terceros

- **Hosting:** el sitio se publica en GitHub Pages. Como cualquier servidor web, el hosting puede registrar
  direcciones IP y datos técnicos de las visitas según sus propias políticas. El proyecto no accede a esos registros.
  Si el juego se sube a otro hosting (itch.io, Netlify o Vercel), vale lo mismo para ese servicio.
- Sin fuentes tipográficas, scripts, analítica, anuncios ni contenido embebido de otros sitios.
- Sin cookies.

## Menores

El público puede incluir menores (edad orientativa 12+, orientación propia, no una clasificación oficial). Como no
se recolecta ningún dato y no hay cuentas, chat ni formularios, no se tratan datos personales de menores.

## Cambios

Si algún día el juego recolectara datos o usara servicios de terceros, este inventario y la política de privacidad
del juego se actualizarían antes de publicar el cambio. La política que se muestra en el panel «Privacidad y
créditos» del menú describe lo mismo que este documento.
