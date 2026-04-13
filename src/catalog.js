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

const metaCache = new Map();

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString());
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function getMetaByImdb(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  const data = await tmdbGet(`/find/${imdbId}`, { external_source: "imdb_id" });
  
  // FIX: Force the correct result array based on content type
  const results = type === "movie" ? data?.movie_results : data?.tv_results;
  const r = results?.[0];

  if (!r) return null;

  const meta = {
    id: imdbId,
    type,
    name: r.title || r.name,
    poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
    description: r.overview,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
  };
  metaCache.set(imdbId, meta);
  return meta;
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip = parseInt(extra.skip || 0);
  const ids = PLATFORM_DATA[catalogId] || [];
  const pageIds = ids.slice(skip, skip + 20);
  if (!pageIds.length) return [];
  const results = await Promise.all(pageIds.map(id => getMetaByImdb(id, type)));
  return results.filter(Boolean);
}

module.exports = { fetchCatalog };
