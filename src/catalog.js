const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY; 

const FALLBACK_IDS = ["tt30141680", "tt31281232", "tt17057710", "tt27495049", "tt32313352", "tt11000702", "tt21064582", "tt13647612"];

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
      description: r.overview,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type) {
  const platform = catalogId.split("_")[0];
  const subtype = catalogId.includes("series") ? "series" : "movies";
  
  let ids = await askGemini(platform, subtype);
  if (!ids || ids.length < 2) ids = FALLBACK_IDS;

  const results = await Promise.all(ids.slice(0, 15).map(id => getMeta(id, type)));
  const filtered = results.filter(Boolean);

  return filtered.length > 0 ? filtered : FALLBACK_IDS.slice(0, 2).map(id => ({ id, type, name: "Loading..." }));
}

module.exports = { fetchCatalog };
