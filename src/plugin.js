// Cine Trivia: a consumer of the plugin protocol (apiVersion 20). Its movies come from the TMDB provider's door "movies"
// (kino-plugin.json "consumes".tmdb), one `kino.plugins.call("tmdb", "random", ...)` per round; its live ticker from the
// door's "trending" stream, switched on by the state flag `protocol.tmdb.trending`.
//
// The gate: until `installed["kinotvapp/kino-plugin-tmdb"]` is true, `screen` draws only the install screen and
// `screenEvent` does nothing. Kino calls `screen` again when the person installs TMDB, so the game appears in place.
//
// The state lives in Kino: `game` (phase, round, score, the question, the clock), `protocol` (Kino's stream flags) and
// `trendingTitle` (the last trending movie). Every patch replaces those keys whole.
import { ROUNDS, SECONDS, TMDB_REPO, buildQuestion, eraArg, points, rememberDirector, secondsLeft } from "./game.js";
import { gameView, installView } from "./views.js";

const gateOpen = (installed) => !!installed && installed[TMDB_REPO] === true;
const gameOf = (state) => (state && state.game && typeof state.game === "object" ? state.game : { phase: "home" });

export async function screen({ state = {}, installed } = {}) {
  if (!gateOpen(installed)) return installView();
  return gameView(state || {});
}

/** A new game: round 0, no points; the directors this opening has seen stay for the wrong options. */
function newGame(previous) {
  return { phase: "home", round: 0, score: 0, used: [], directors: Array.isArray(previous.directors) ? previous.directors : [] };
}

/** One movie from the provider, asked again once if it was already played in this game. */
async function fetchMovie(used) {
  let movie = await kino.plugins.call("tmdb", "random", eraArg(Math.random));
  if (used.includes(movie.id)) movie = await kino.plugins.call("tmdb", "random", eraArg(Math.random));
  return movie;
}

/** The next round's question for [game], or the failure state. The person's press: the focus goes to the first option or to retry. */
async function round(game) {
  try {
    const movie = await fetchMovie(game.used || []);
    const q = { ...buildQuestion(movie, { directors: game.directors || [], rng: Math.random }), answered: null };
    const next = {
      ...game, phase: "question", q, error: null, deadline: Date.now() + SECONDS * 1000, left: SECONDS,
      used: [...(game.used || []), movie.id], directors: rememberDirector(game.directors, movie.director),
    };
    return { state: { game: next }, focus: "opt0" };
  } catch (e) {
    const code = e && typeof e.code === "string" ? e.code : "provider_failed";
    return { state: { game: { ...game, phase: "error", error: code, q: null } }, focus: "retry" };
  }
}

/** The question answered with option [picked] (-1: the time ran out). */
function answer(game, picked, timeout) {
  const q = game.q;
  const left = timeout ? 0 : secondsLeft(game.deadline, Date.now());
  const pts = timeout ? 0 : points(picked === q.correct, left);
  return { ...game, score: (game.score || 0) + pts, round: (game.round || 0) + 1, left, q: { ...q, answered: { picked, points: pts, timeout } } };
}

const waiting = (game) => game.phase === "question" && game.q && !game.q.answered;

export async function screenEvent({ name, arg, value, state = {}, installed } = {}) {
  if (!gateOpen(installed)) return null;
  const st = state || {};
  const game = gameOf(st);
  switch (name) {
    case "start":
    case "again":
      return round(newGame(game));
    case "retry":
      return game.phase === "error" ? round(game) : null;
    case "next":
      if (game.phase !== "question" || !game.q || !game.q.answered) return null;
      if ((game.round || 0) >= ROUNDS) return { state: { game: { ...game, phase: "result", q: null } }, focus: "again" };
      return round(game);
    case "answer": {
      if (!waiting(game)) return null;
      const picked = Number.parseInt(String(arg), 10);
      if (!Number.isInteger(picked) || picked < 0 || picked >= game.q.options.length) return null;
      // Kino sends no tick while it is in the background: a tap after the deadline is the timeout the tick would have been.
      const late = secondsLeft(game.deadline, Date.now()) <= 0;
      return { state: { game: late ? answer(game, -1, true) : answer(game, picked, false) }, focus: "next" };
    }
    case "tick": {
      if (!waiting(game)) return null;
      const left = secondsLeft(game.deadline, Date.now());
      if (left <= 0) return { state: { game: answer(game, -1, true) } };
      return left === game.left ? null : { state: { game: { ...game, left } } };
    }
    case "trending": {
      const on = value === true;
      if (on === (st.protocol?.tmdb?.trending === true)) return null; // unchanged: the ticker stays
      return { state: { protocol: { tmdb: { trending: on } }, trendingTitle: null } };
    }
    case "protocol": {
      if (st.protocol?.tmdb?.trending !== true) return null;
      if (!arg || arg.alias !== "tmdb" || arg.stream !== "trending" || !Array.isArray(arg.items)) return null;
      const movie = arg.items.find((m) => m && typeof m.title === "string" && m.title.trim());
      return movie ? { state: { trendingTitle: movie.title.slice(0, 120) } } : null;
    }
    default:
      return null;
  }
}
