const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BG = "https://image.tmdb.org/t/p/w1280";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function findByImdb(imdbId) {
  return tmdbGet(`/find/${imdbId}`, { external_source: "imdb_id" });
}

async function fullDetails(tmdbId, mediaType) {
  return tmdbGet(`/${mediaType}/${tmdbId}`);
}

function toStremioMeta(item, imdbId, type) {
  if (!item) return null;

  return {
    id: imdbId,
    type,
    name: item.title || item.name || "Unknown",
    poster: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : undefined,
    background: item.backdrop_path ? `${TMDB_BG}${item.backdrop_path}` : undefined,
    description: item.overview || undefined,
    releaseInfo: (item.release_date || item.first_air_date || "").slice(0, 4) || undefined,
    posterShape: "poster"
  };
}

async function getMetaFromImdb(imdbId, type) {
  const found = await findByImdb(imdbId);
  if (!found) return null;

  const base =
    type === "movie"
      ? found.movie_results && found.movie_results[0]
      : found.tv_results && found.tv_results[0];

  if (!base) return null;

  const mediaType = type === "movie" ? "movie" : "tv";
  const detailed = await fullDetails(base.id, mediaType);

  return toStremioMeta(detailed || base, imdbId, type);
}

module.exports = { getMetaFromImdb };
