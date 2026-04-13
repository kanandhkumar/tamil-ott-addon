const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const PLATFORM_DATA = {
  netflix_tamil: ["tt30232491", "tt31105157", "tt28091871", "tt21064582", "tt13647612", "tt27495049", "tt9019536"],
  prime_tamil: ["tt27773285", "tt14519434", "tt31034446", "tt21064582", "tt32030465"],
  jiohotstar_movies: ["tt13121618", "tt15655792", "tt14539740", "tt6016236", "tt8143610", "tt9019536", "tt10399902", "tt12412888", "tt21064582"],
  sunnxt_movies: ["tt8108198", "tt15655792", "tt8143610", "tt7144870", "tt9764938", "tt10837246", "tt12412888", "tt14539740", "tt16365614"],
  aha_movies: ["tt16323862", "tt28091871", "tt21262612", "tt15428204", "tt8367814"],
  zee5_movies: ["tt31105157", "tt21064582", "tt15428204", "tt26343544"],
  sonyliv_movies: ["tt21262612", "tt15428204", "tt16323862"],
  sunnxt_series: ["tt12077116", "tt15256628"],
  aha_webseries: ["tt15256628", "tt14444952", "tt13615776"]
};

async function getMetaByImdb(imdbId, type) {
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Explicitly target the first result in the correct category
    const r = type === "movie" ? (data.movie_results?.[0]) : (data.tv_results?.[0]);

    // If TMDB doesn't find the exact match, return null to avoid random Hollywood titles
    if (!r || !r.poster_path) return null;

    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`,
      description: r.overview || "Tamil content description available soon.",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) {
    return null;
  }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const ids = PLATFORM_DATA[catalogId] || [];
  const skip = parseInt(extra.skip || 0);
  const pageIds = ids.slice(skip, skip + 20);

  const results = await Promise.all(pageIds.map(id => getMetaByImdb(id, type)));
  // Filter out nulls so the list only contains your specific Tamil movies
  return results.filter(val => val !== null);
}

module.exports = { fetchCatalog };
