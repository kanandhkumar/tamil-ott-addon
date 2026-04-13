const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY;

// Verified IDs for the 4 movies
const TEST_MOVIES = ["tt30141680", "tt31281232", "tt17057710", "tt13647612"];

async function getMeta(imdbId, type) {
  if (!TMDB_KEY) return null;
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
      background: `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`,
      description: r.overview || "Tamil Content",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type) {
  const platform = catalogId.split("_")[0].toLowerCase();
  
  // 1. Try Gemini
  let ids = await askGemini(platform, type);
  
  // 2. If Gemini is empty, use our 4 test movies as a global fallback
  // This ensures no row stays empty while we're testing
  if (!ids || ids.length === 0) {
    console.log(`Fallback triggered for ${platform}`);
    ids = TEST_MOVIES;
  }

  const results = await Promise.all(ids.map(id => getMeta(id, type)));
  const filtered = results.filter(Boolean);

  // 3. Final safety: If TMDB fails, send basic data so Stremio shows something
  return filtered.length > 0 ? filtered : TEST_MOVIES.map(id => ({ id, type, name: "Loading..." }));
}

module.exports = { fetchCatalog };