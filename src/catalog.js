const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY;

// TEST DATA: Hard-coding the platforms for our 4 movies to test logic
const TEST_ALLOCATION = {
  netflix: ["tt30141680"], // Maharaja
  prime: ["tt31281232"],   // Raayan
  sunnxt: ["tt17057710"],  // Thiruchitrambalam (SunNXT Original)
  aha: ["tt13647612"]      // Example for Aha
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
  const platformKey = catalogId.split("_")[0].toLowerCase();
  
  // 1. Try Gemini first
  let ids = await askGemini(platformKey, type);
  
  // 2. If Gemini fails, use our hard-coded Test Allocation so the row isn't empty
  if (!ids || ids.length === 0) {
    console.log(`Gemini empty for ${platformKey}, using TEST_ALLOCATION`);
    ids = TEST_ALLOCATION[platformKey] || [];
  }

  const results = await Promise.all(ids.map(id => getMeta(id, type)));
  return results.filter(Boolean);
}

module.exports = { fetchCatalog };
