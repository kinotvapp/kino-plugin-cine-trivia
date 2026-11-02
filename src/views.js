// The trees Kino draws. Every text a person reads goes with its English twin (`text` + `textEn`, `labelText` +
// `labelTextEn`...). On the TV the primary action of each view comes first in tree order and carries `autofocus`, so the
// remote lands on it; the trending switch is always last.
import { ROUNDS, SECONDS, TMDB_REPO, resultMessage } from "./game.js";

const text = (es, en, more = {}) => ({ type: "Text", text: es, textEn: en, ...more });
const primary = (key, es, en, onPressed) => ({ type: "ElevatedButton", key, labelText: es, labelTextEn: en, onPressed, autofocus: true });

/** The only view while TMDB is not installed: a title, one sentence and the one button that opens Kino's install sheet. */
export function installView() {
  return {
    type: "Column", padding: 24, gap: 16, crossAxisAlignment: "center", children: [
      text("Cine Trivia", "Cine Trivia", { style: "h1", textAlign: "center" }),
      text("Para jugar necesitas el plugin TMDB: de ahí salen las películas de cada pregunta.",
        "To play you need the TMDB plugin: every question's movies come from it.", { textAlign: "center" }),
      primary("install", "Instalar TMDB", "Install TMDB", { go: { installPlugin: { repo: TMDB_REPO } } }),
    ],
  };
}

/** The top line: the name, and what the game is doing (or the round and the points). */
function header(left, right) {
  return { type: "Row", mainAxisAlignment: "spaceBetween", children: [left, right] };
}
const brand = () => text("Cine Trivia", "Cine Trivia", { style: "h4" });

/** The live trending switch and its ticker, at the bottom of every game view. */
function trendingBar(state) {
  const on = state.protocol?.tmdb?.trending === true;
  const title = typeof state.trendingTitle === "string" && state.trendingTitle ? state.trendingTitle : null;
  const ticker = !on
    ? text("apagado", "off", { key: "ticker", style: "caption", color: "muted" })
    : title
      ? text(`▲ ${title} sube en tendencias`, `▲ ${title} is trending up`, { key: "ticker", style: "caption", color: "secondary", maxLines: 2 })
      : text("esperando aviso de TMDB…", "waiting for TMDB…", { key: "ticker", style: "caption", color: "muted" });
  return {
    type: "Column", gap: 4, children: [
      { type: "Divider" },
      { type: "Switch", key: "trendingSwitch", labelText: "Tendencias en vivo", labelTextEn: "Live trending", value: on, onChanged: "trending" },
      ticker,
    ],
  };
}

function homeView() {
  return [
    header(brand(), text("plugin", "plugin", { style: "caption", color: "muted" })),
    text("Cinco preguntas.\nQuince segundos cada una.", "Five questions.\nFifteen seconds each.", { style: "h2" }),
    text("Las películas llegan desde el plugin de TMDB que tienes instalado.", "The movies come from the TMDB plugin you have installed.", { color: "muted" }),
    primary("start", "Empezar", "Start", "start"),
  ];
}

/** The movie's card: its poster (or Kino's movie icon), what is asked about it, its title. */
function movieCard(q) {
  const picture = { type: "Image", aspect: "2:3", width: 80, alt: q.movie.title, altEn: q.movie.title,
    fallback: { type: "Column", padding: 8, children: [{ type: "Icon", name: "movie" }] } };
  if (q.movie.posterUrl) picture.url = q.movie.posterUrl;
  return {
    type: "Card", variant: "filled", children: [{
      type: "Row", gap: 12, crossAxisAlignment: "center", children: [
        picture,
        { type: "Column", gap: 4, flex: 1, children: [
          q.kind === "director" ? text("Director", "Director", { style: "caption" }) : text("Año", "Year", { style: "caption" }),
          text(q.movie.title, q.movie.title, { style: "h2", maxLines: 3 }),
        ] },
      ],
    }],
  };
}

function questionView(game) {
  const { q } = game;
  const n = q.answered ? game.round : game.round + 1; // the round on show (game.round counts the answered ones)
  const left = Number.isFinite(game.left) ? game.left : SECONDS;
  const children = [
    header(text(`Pregunta ${n} de ${ROUNDS}`, `Question ${n} of ${ROUNDS}`, { style: "label" }),
      text(`Puntos ${game.score}`, `Points ${game.score}`, { style: "label" })),
    { type: "LinearProgressIndicator", value: q.answered ? 0 : left / SECONDS, labelText: `${left} s`, labelTextEn: `${left} s` },
    movieCard(q),
    q.kind === "director"
      ? text("¿Quién dirigió esta película?", "Who directed this movie?", { style: "h3" })
      : text("¿En qué año se estrenó?", "What year did it come out?", { style: "h3" }),
  ];
  if (!q.answered) {
    children.push({ type: "Column", gap: 8, children: q.options.map((o, i) => ({
      type: "Button", variant: "secondary", key: "opt" + i, labelText: o, labelTextEn: o, onPressed: { event: "answer", arg: String(i) },
      ...(i === 0 ? { autofocus: true } : {}),
    })) });
    return children;
  }
  const a = q.answered;
  children.push({ type: "Column", gap: 8, children: q.options.map((o, i) => {
    if (i === q.correct) return { type: "Card", variant: "outlined", key: "shown" + i, children: [text(`✓ ${o}`, `✓ ${o}`, { color: "primary", bold: true })] };
    if (i === a.picked) return { type: "Card", variant: "outlined", key: "shown" + i, children: [text(`✕ ${o}`, `✕ ${o}`, { color: "error" })] };
    return { type: "Card", variant: "outlined", key: "shown" + i, children: [text(o, o, { color: "muted" })] };
  }) });
  children.push(a.timeout
    ? text("Se acabó el tiempo.", "Time's up.", { style: "h4", color: "warning" })
    : a.picked === q.correct
      ? text(`¡Correcto! +${a.points} puntos`, `Correct! +${a.points} points`, { style: "h4", color: "primary" })
      : text("No era esa.", "Not that one.", { style: "h4", color: "error" }));
  const last = game.round >= ROUNDS;
  children.push(primary("next", last ? "Ver resultado" : "Siguiente", last ? "See the result" : "Next", "next"));
  return children;
}

function resultView(game) {
  const msg = resultMessage(game.score);
  return [
    header(brand(), text("fin", "the end", { style: "caption", color: "muted" })),
    { type: "Column", gap: 8, crossAxisAlignment: "center", children: [
      text("Tu puntaje", "Your score", { color: "muted" }),
      text(String(game.score), String(game.score), { style: "hero" }),
      text(msg.es, msg.en, { style: "h3" }),
    ] },
    primary("again", "Jugar otra vez", "Play again", "again"),
  ];
}

/** What went wrong, in the person's words, by the error code of kino.plugins.call. */
export function errorLine(code) {
  switch (code) {
    case "provider_missing": return ["El plugin TMDB está apagado o le falta configurarse. Revísalo en Plugins y vuelve a intentarlo.", "The TMDB plugin is off or needs setting up. Check it in Plugins and try again."];
    case "rate_limited": return ["TMDB pidió una pausa. Espera unos segundos y vuelve a intentarlo.", "TMDB asked for a break. Wait a few seconds and try again."];
    case "timeout": return ["TMDB tardó demasiado en responder. Vuelve a intentarlo.", "TMDB took too long to answer. Try again."];
    default: return ["Algo falló al pedirle la película a TMDB. Vuelve a intentarlo.", "Something went wrong asking TMDB for the movie. Try again."];
  }
}

function errorView(game) {
  const [es, en] = errorLine(game.error);
  return [
    header(brand(), text(`Puntos ${game.score ?? 0}`, `Points ${game.score ?? 0}`, { style: "label" })),
    { type: "errorState", title: "No pudimos traer la película", titleEn: "We couldn't get the movie", text: es, textEn: en, icon: "refresh" },
    primary("retry", "Reintentar", "Try again", "retry"),
  ];
}

/** The game: home, a question, the result or a failure, with the trending bar under it. The countdown ticks only while a question waits. */
export function gameView(state) {
  const game = state.game && typeof state.game === "object" ? state.game : { phase: "home" };
  let children;
  if (game.phase === "question" && game.q) children = questionView(game);
  else if (game.phase === "result") children = resultView(game);
  else if (game.phase === "error") children = errorView(game);
  else children = homeView();
  const root = { type: "Column", padding: 16, gap: 16, children: [...children, trendingBar(state)] };
  if (game.phase === "question" && game.q && !game.q.answered) root.every = { ms: 1000, event: "tick" };
  return root;
}
