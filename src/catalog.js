const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY;

// TEST DATA: Ensuring these 4 major hits always show up in their rows
const MANUAL_MAP = {
  netflix: ["tt30141680"], // Maharaja
  prime: ["tt31281232"],   // Raayan
  sunnxt: ["tt17057710"],  // Thiruchitrambalam
  aha: ["tt13647612"]      // Chitha
};

async function getMeta(imdbId, type) {
  if (!TMDB_KEY) return null;
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

    if (!r || !r.poster_path) return null;

    return {
      id: imdbId,
      type: type,
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
  
  // 1. Try Gemini Search
  let ids = await askGemini(platform, type);
  
  // 2. Merge with Manual Map to ensure rows aren't empty
  const fixedIds = MANUAL_MAP[platform] || [];
  ids = Array.from(new Set([...(ids || []), ...fixedIds]));

  // 3. Last Resort Fallback (Maharaja and Raayan)
  if (ids.length === 0) ids = ["tt30141680", "tt31281232"];

  const results = await Promise.all(ids.map(id => getMeta(id, type)));
  return results.filter(Boolean);
}

module.exports = { fetchCatalog };
