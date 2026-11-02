# Cine Trivia

Un juego de trivia de cine para Kino: cinco preguntas de 15 segundos, de director y de año de estreno, con películas reales.
*A movie trivia game for Kino: five 15-second questions about directors and release years, with real movies.*

## Cómo funciona / How it works

Cine Trivia no consulta ningún servidor: le pide las películas al plugin **[TMDB](https://github.com/kinotvapp/kino-plugin-tmdb)** a través de Kino, usando el protocolo entre plugins (`consumes`).
Antes de mostrar el juego revisa si TMDB está instalado. Si no lo está, muestra solo un botón que abre el cuadro de instalación de Kino; nada se instala sin que toques «Agregar».

*Cine Trivia calls no server of its own: it asks the **TMDB** plugin for movies through Kino, using the plugin protocol (`consumes`). Before showing the game it checks that TMDB is installed; if not, it only shows a button that opens Kino's install dialog. Nothing installs without you tapping "Add".*

- Requiere Kino 0.9.81 o más nuevo (apiVersion 20) y el plugin TMDB 1.3.0 o más nuevo.
- Puntaje: acierto = 10 + 2 × ⌈segundos que quedan / 3⌉; fallo o tiempo agotado = 0.
- Un interruptor de «Tendencias en vivo» muestra lo que sube en TMDB mientras juegas.

## Para desarrolladores / For developers

El código está en `src/`; `plugin.js` es el paquete que Kino carga. Después de editar `src/`: `npm install && npm run build`, y `npm run check:built` confirma que `plugin.js` coincide con `src/`.

Licencia / License: Apache-2.0.
