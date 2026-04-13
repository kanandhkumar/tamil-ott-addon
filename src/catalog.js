const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "F55610914fb734a9afd993aa70a951d7";

const PLATFORM_DATA = {
  netflix_tamil: ["tt30141680", "tt21064582", "tt27495049", "tt28091871", "tt32313352"], 
  prime_tamil: ["tt17057710", "tt15428204", "tt21262612", "tt14519434", "tt11000702"], 
  jiohotstar_movies: ["tt30141680", "tt27495049", "tt17057710", "tt13121618"], 
  sunnxt_movies: ["tt11000702", "tt7144870", "tt10837246", "tt12412888"], 
  aha_movies: ["tt21262612", "tt16323862", "tt15428204", "tt21136150"], 
  zee5_movies: ["tt26343544", "tt21064582", "tt15428204"], 
  sonyliv_movies: ["tt21262612", "tt16323862"],
  sunnxt_series: ["tt12077116", "tt15256628"],
  aha_webseries: ["tt15256628", "tt14444952", "tt13615776"]
};

async function getMetaByImdb(imdbId, type) {
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`;
    const res = await fetch(url);
    const data = await res.json();
    const r = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

    if (!r) return null;

    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
      background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      description: r.overview,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const ids = PLATFORM_DATA[catalogId] || [];
  const skip = parseInt(extra.skip || 0);
  const pageIds = ids.slice(skip, skip + 20);
  const results = await Promise.all(pageIds.map(id => getMetaByImdb(id, type)));
  return results.filter(val => val !== null);
}

module.exports = { fetchCatalog };
