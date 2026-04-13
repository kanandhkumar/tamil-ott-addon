const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "F55610914fb734a9afd993aa70a951d7";

// 100% Verified Tamil IDs - No Hollywood leftovers
const FALLBACK_MOVIES = [
  "tt30141680", "tt31281232", "tt27495049", "tt17057710", "tt32313352", // Maharaja, Raayan, Lucky, With Love
  "tt11000702", "tt21064582", "tt21262612", "tt13647612", "tt31281232", // PS-1, Viduthalai, Thiruchitrambalam
  "tt10837246", "tt12412888", "tt7144870", "tt10399902", "tt9019536"
];

const FALLBACK_SERIES = [
  "tt21092576", "tt21263012", "tt12077116", "tt15256628", "tt27678502", // Ayali, Sweet Kaaram Coffee, Inspector Rishi
  "tt14444952", "tt11847842", "tt13615776", "tt8291220", "tt21136150"
];

function rotateFallback(arr, platform) {
  const n = { sunnxt:0, zee5:3, jiohotstar:6, aha:9, sonyliv:12 }[platform] || 0;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

const metaCache = new Map();

async function getMeta(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

    // REJECT if not Tamil or missing poster
    if (!r || !r.poster_path || (r.original_language && r.original_language !== "ta")) {
      metaCache.set(imdbId, null);
      return null;
    }

    const meta = {
      id: imdbId, type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      description: r.overview,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
    metaCache.set(imdbId, meta);
    return meta;
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const platform = catalogId.split("_")[0];
  const subtype = catalogId.replace(`${platform}_`, "");
  
  let ids = null;
  try { ids = await askGemini(platform, subtype); } catch (e) {}

  if (!ids || ids.length < 3) {
    const isMovie = subtype === "movies" || subtype === "shorts";
    ids = rotateFallback(isMovie ? FALLBACK_MOVIES : FALLBACK_SERIES, platform);
  }

  const pageIds = ids.slice(parseInt(extra.skip || 0), parseInt(extra.skip || 0) + 20);
  const results = await Promise.all(pageIds.map(id => getMeta(id, type)));
  
  // Final safeguard: if row is empty, push verified fallbacks immediately
  const filtered = results.filter(Boolean);
  if (filtered.length === 0) {
     const emergency = rotateFallback(FALLBACK_MOVIES, "aha").slice(0, 5);
     const emergencyRes = await Promise.all(emergency.map(id => getMeta(id, type)));
     return emergencyRes.filter(Boolean);
  }

  return filtered;
}

module.exports = { fetchCatalog };
