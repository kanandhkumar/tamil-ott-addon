const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const PLATFORM_DATA = {
  netflix_tamil: ["tt30232491", "tt31105157", "tt28091871", "tt15671028", "tt13647612", "tt6712648", "tt9019536"],
  prime_tamil: ["tt27773285", "tt14519434", "tt31034446", "tt8291224", "tt9032398"],
  jiohotstar_movies: ["tt13121618", "tt15655792", "tt14539740", "tt6016236", "tt8143610", "tt9019536", "tt10399902", "tt12412888", "tt9032398", "tt15671028"],
  sunnxt_movies: ["tt8108198", "tt15655792", "tt8143610", "tt7144870", "tt9764938", "tt10837246", "tt9032398", "tt12412888", "tt14539740", "tt16365614"],
  aha_movies: ["tt9032398", "tt15671028", "tt10399902", "tt9019536", "tt8367814", "tt6712648", "tt9764938", "tt8108198", "tt7504726", "tt9032400"],
  zee5_movies: ["tt9019536", "tt10399902", "tt8367814", "tt6712648", "tt9764938", "tt15671028", "tt9032398", "tt10837246", "tt7504726", "tt9032400"],
  sonyliv_movies: ["tt8367814", "tt6712648", "tt9764938", "tt10399902", "tt9019536", "tt15671028", "tt9032398", "tt8108198", "tt7504726", "tt9032400"],
  sunnxt_series: ["tt8291224", "tt14519434", "tt9032401", "tt12077116", "tt15256628"],
  aha_webseries: ["tt15256628", "tt14444952", "tt13615776", "tt11847842", "tt10954984"]
};

async function getMetaByImdb(imdbId, type) {
  try {
    // We must use backticks for the URL on mobile to ensure it's a clean string
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Force strictly choosing the right array. TMDB find results are arrays.
    const r = type === "movie" ? (data.movie_results && data.movie_results[0]) : (data.tv_results && data.tv_results[0]);

    // If TMDB doesn't find the exact match, return null so we don't show wrong movies
    if (!r || !r.poster_path) return null;

    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`,
      description: r.overview || "No description available.",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const ids = PLATFORM_DATA[catalogId] || [];
  const skip = parseInt(extra.skip || 0);
  const pageIds = ids.slice(skip, skip + 20);

  // Use Promise.all to fetch metadata for all IDs in the batch
  const results = await Promise.all(pageIds.map(id => getMetaByImdb(id, type)));
  
  // Filter out any nulls where TMDB failed to find the movie
  return results.filter(item => item !== null);
}

module.exports = { fetchCatalog };
