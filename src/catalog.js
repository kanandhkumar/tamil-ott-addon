const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY;

async function getMeta(imdbId, type) {
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
      description: r.overview,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type) {
  // Extract platform name from catalog ID (e.g., "netflix_tamil" -> "Netflix")
  const platform = catalogId.split("_")[0];
  
  // 1. Gemini finds which of our 4 test movies belong to this specific platform
  let ids = await askGemini(platform, type);
  
  if (!ids || ids.length === 0) {
    console.log(`No movies found for ${platform} in this test.`);
    return [];
  }

  // 2. Fetch the metadata (Posters/Names) for those specific IDs
  const results = await Promise.all(ids.map(id => getMeta(id, type)));
  return results.filter(Boolean);
}

module.exports = { fetchCatalog };
