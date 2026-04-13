const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = "f55610914fb734a9afd993aa70a951d7";

const FALLBACK_IDS = ["tt30141680", "tt31281232", "tt17057710", "tt27495049", "tt32313352", "tt11000702", "tt21064582", "tt13647612"];

async function getMeta(imdbId, type) {
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Pick the right result set based on type
    const results = type === "movie" ? data.movie_results : data.tv_results;
    const r = results && results[0];

    if (!r || !r.poster_path) return null;

    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      description: r.overview || "",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) {
    console.error("TMDB Error for " + imdbId, e);
    return null;
  }
}

async function fetchCatalog(catalogId, type) {
  const platform = catalogId.split("_")[0];
  const subtype = catalogId.includes("series") ? "series" : "movies";
  
  let ids = await askGemini(platform, subtype);
  
  // If Gemini doesn't return enough, use our verified Tamil list
  if (!ids || ids.length < 3) {
    ids = FALLBACK_IDS;
  }

  const results = await Promise.all(ids.slice(0, 15).map(id => getMeta(id, type)));
  const filtered = results.filter(Boolean);

  // If we have actual movie data, return it. 
  // If TMDB is still struggling, return the Fallback with names so it's not "Loading..."
  return filtered.length > 0 ? filtered : [
    { id: "tt30141680", type, name: "Maharaja", poster: "https://image.tmdb.org/t/p/w500/9Pf9t9y96of7Yp9ptUasYvInS6L.jpg" },
    { id: "tt17057710", type, name: "Raayan", poster: "https://image.tmdb.org/t/p/w500/8O7mD908MvBfN6SntQ9YpMh24pB.jpg" }
  ];
}

module.exports = { fetchCatalog };
