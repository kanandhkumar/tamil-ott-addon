const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
// Using your verified key directly to avoid "metas:[]" errors
const TMDB_KEY  = "F55610914fb734a9afd993aa70a951d7";

const FALLBACK_MOVIES = [
  "tt30141680", "tt31281232", "tt27495049", "tt17057710", "tt32313352",
  "tt11000702", "tt21064582", "tt21262612", "tt13647612", "tt10837246"
];

const FALLBACK_SERIES = [
  "tt21092576", "tt21263012", "tt12077116", "tt15256628", "tt27678502"
];

async function getMeta(imdbId, type) {
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

    if (!r || !r.poster_path) return null;

    return {
      id: imdbId, type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      description: r.overview,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const platform = catalogId.split("_")[0];
  const subtype = catalogId.replace(`${platform}_`, "");
  
  let ids = null;
  try { 
    ids = await askGemini(platform, subtype); 
  } catch (e) {
    console.log("Gemini failed, using fallback");
  }

  if (!ids || ids.length < 2) {
    ids = subtype.includes("series") ? FALLBACK_SERIES : FALLBACK_MOVIES;
  }

  const pageIds = ids.slice(0, 20);
  const results = await Promise.all(pageIds.map(id => getMeta(id, type)));
  const filtered = results.filter(Boolean);

  // If even TMDB fails, return basic IDs so Stremio doesn't show an error
  return filtered.length > 0 ? filtered : pageIds.map(id => ({ id, type, name: "Loading..." }));
}

module.exports = { fetchCatalog };
