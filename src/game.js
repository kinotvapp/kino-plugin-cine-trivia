// The game's rules, with no Kino in them: questions, scoring, the clock and the result message. Pure functions, so the
// tests can drive them with a fixed rng and a fixed clock.

/** The provider's repository: the key of `installed`, `recommends` and `consumes.tmdb.repo`. */
export const TMDB_REPO = "kinotvapp/kino-plugin-tmdb";
export const ROUNDS = 5;
export const SECONDS = 15;
/** The highest score: every answer right with the full 15 s left (10 + 2 * 5 each). */
export const MAX_SCORE = ROUNDS * (10 + 2 * Math.ceil(SECONDS / 3));

/**
 * Well-known directors for the director question's wrong options, used after the ones this opening already fetched: a
 * distractor never costs a provider call.
 */
export const KNOWN_DIRECTORS = [
  "Steven Spielberg", "Christopher Nolan", "Quentin Tarantino", "Martin Scorsese", "Alfonso Cuarón", "Guillermo del Toro",
  "Alejandro G. Iñárritu", "Hayao Miyazaki", "Greta Gerwig", "Denis Villeneuve", "Pedro Almodóvar", "Kathryn Bigelow",
  "Ridley Scott", "James Cameron", "Bong Joon-ho", "Sofia Coppola", "Stanley Kubrick", "Francis Ford Coppola",
];

/** The eras a round asks TMDB for, so five rounds are not five of this year's hits. */
const ERAS = [[1970, 1979], [1980, 1989], [1990, 1999], [2000, 2009], [2010, 2019], [2020, null]];
/** How far a wrong year may be from the right one. */
const YEAR_SPREAD = 12;
/** Directors this opening remembers for distractors. */
const MAX_DIRECTORS = 24;

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** A copy of [list] in a random order. */
export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The argument of one `random` call: a random era (the last one is open-ended). */
export function eraArg(rng) {
  const [fromYear, toYear] = pick(ERAS, rng);
  return toYear === null ? { fromYear } : { fromYear, toYear };
}

/** Whole seconds left before [deadline] at [now], rounded up, from 0 to SECONDS. */
export function secondsLeft(deadline, now) {
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.min(SECONDS, Math.ceil((deadline - now) / 1000)));
}

/** A right answer is worth 10 plus a speed bonus of 2 per started 3 s left; a wrong one or a timeout 0. */
export function points(correct, left) {
  return correct ? 10 + 2 * Math.ceil(Math.max(0, left) / 3) : 0;
}

/** The message under the final score, `{ es, en }`: by the share of the highest score. */
export function resultMessage(score) {
  if (score >= MAX_SCORE * 0.8) return { es: "Cinéfilo de verdad.", en: "A true film buff." };
  if (score >= MAX_SCORE * 0.4) return { es: "Buen ojo.", en: "Good eye." };
  return { es: "A ver más cine.", en: "Time to watch more movies." };
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** [directors] with [name] added (once, ignoring case), the newest last, bounded. */
export function rememberDirector(directors, name) {
  const list = Array.isArray(directors) ? directors.filter((d) => typeof d === "string") : [];
  if (typeof name !== "string" || !name.trim() || list.some((d) => same(d, name))) return list;
  return [...list, name].slice(-MAX_DIRECTORS);
}

/**
 * One question about [movie] (a Movie of the TMDB door): who directed it (only when TMDB knows the director) or the year it
 * came out, at random. Four options, one right: `{ kind, movie, options, correct }`, [correct] its index. The wrong
 * directors are the ones this opening fetched ([directors]) first, then well-known ones; the wrong years are near the right
 * one and never after [thisYear].
 */
export function buildQuestion(movie, { directors = [], rng = Math.random, thisYear = new Date().getFullYear() } = {}) {
  const kind = typeof movie.director === "string" && movie.director.trim() && rng() < 0.5 ? "director" : "year";
  let right;
  let wrong;
  if (kind === "director") {
    right = movie.director;
    const seen = shuffle(directors.filter((d) => typeof d === "string" && !same(d, right)), rng);
    const known = shuffle(KNOWN_DIRECTORS.filter((d) => !same(d, right) && !seen.some((s) => same(s, d))), rng);
    wrong = [...seen, ...known].slice(0, 3);
  } else {
    right = String(movie.year);
    const near = [];
    for (let d = -YEAR_SPREAD; d <= YEAR_SPREAD; d++) {
      const y = movie.year + d;
      if (d !== 0 && y <= thisYear) near.push(String(y));
    }
    wrong = shuffle(near, rng).slice(0, 3);
  }
  const options = shuffle([right, ...wrong], rng);
  const shown = { id: movie.id, title: movie.title, year: movie.year };
  if (typeof movie.posterUrl === "string") shown.posterUrl = movie.posterUrl;
  return { kind, movie: shown, options, correct: options.indexOf(right) };
}
