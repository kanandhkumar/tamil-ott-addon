const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const GENRE_MAP = {
  Action:28, Drama:18, Comedy:35, Thriller:53, Romance:10749,
  Horror:27, Family:10751, "Sci-Fi":878, Animation:16, Crime:80,
  Reality:10764, News:10763,
};

const PROVIDER_IDS = {
  sunnxt:237, zee5:232, hotstar:122, aha:532,
  mxplayer:515, kalaignar:237, sonyliv:11,
};

const SORT_BY = {
  sunnxt:"popularity.desc", zee5:"vote_average.desc",
  hotstar:"popularity.desc", aha:"primary_release_date.desc",
  mxplayer:"revenue.desc", kalaignar:"vote_count.desc", sonyliv:"vote_average.desc",
};

const YEAR_FROM = {
  sunnxt:"2022-01-01", zee5:"2021-01-01", hotstar:"2023-01-01",
  aha:"2022-01-01", mxplayer:"2021-01-01", kalaignar:"2018-01-01", sonyliv:"2021-01-01",
};

// In-memory cache for IMDB ID lookups
const imdbCache = new Map();

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { timeout: 10000 });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Get IMDB tt ID from TMDB ID
async function getImdbId(tmdbId, mediaType) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (imdbCache.has(cacheKey)) return imdbCache.get(cacheKey);
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/external_ids`);
  const imdbId = data && data.imdb_id ? data.imdb_id : null;
  if (imdbId) imdbCache.set(cacheKey, imdbId);
  return imdbId;
}

// Convert TMDB result to Stremio meta with real IMDB ID
async function toMeta(r, type) {
  if (!r || !r.poster_path) return null;
  if (r.original_language && r.original_language !== "ta") return null;

  const mediaType = type === "movie" ? "movie" : "tv";
  const imdbId = await getImdbId(r.id, mediaType);
  if (!imdbId) return null; // Skip items without IMDB ID

  return {
    id: imdbId,  // Real tt ID — works with Cinemeta + Torrentio
    type,
    name: r.title || r.name || "Unknown",
    poster: `${TMDB_IMG}${r.poster_path}`,
    background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
  };
}

async function discoverTamil(type, platform, page, genre) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const params = {
    page,
    with_original_language: "ta",
    sort_by: SORT_BY[platform] || "popularity.desc",
    "vote_count.gte": 20,
  };

  const providerId = PROVIDER_IDS[platform];
  if (providerId) {
    params.with_watch_providers = providerId;
    params.watch_region = "IN";
  }

  if (genre && GENRE_MAP[genre]) params.with_genres = GENRE_MAP[genre];

  const yearFrom = YEAR_FROM[platform];
  if (yearFrom) {
    if (mediaType === "movie") params["primary_release_date.gte"] = yearFrom;
    else params["first_air_date.gte"] = yearFrom;
  }

  const data = await tmdbGet(`/discover/${mediaType}`, params);
  if (!data || !data.results) return [];

  // Fetch IMDB IDs in parallel (limit to 20)
  const results = await Promise.all(
    data.results.slice(0, 20).map(r => toMeta(r, type))
  );
  return results.filter(Boolean);
}

async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, { query, page });
  if (!data || !data.results) return [];
  const filtered = data.results.filter(r => r.original_language === "ta").slice(0, 20);
  const results = await Promise.all(filtered.map(r => toMeta(r, type)));
  return results.filter(Boolean);
}

// Seed fallback when no TMDB key — real IMDB IDs
const SEED_MOVIES = [
  { id:"tt6016236", name:"Vikram",             poster:"https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg" },
  { id:"tt8143610", name:"Master",             poster:"https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg" },
  { id:"tt7144870", name:"Bigil",              poster:"https://image.tmdb.org/t/p/w500/5VEJlv5OQw5rlWbfUgNW9j18xwM.jpg" },
  { id:"tt9019536", name:"Soorarai Pottru",    poster:"https://image.tmdb.org/t/p/w500/xBDGHXHpBJ8OPnCGGOILqbVxVOi.jpg" },
  { id:"tt10399902",name:"Jai Bhim",           poster:"https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg" },
  { id:"tt13121618",name:"Ponniyin Selvan: I", poster:"https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg" },
  { id:"tt15655792",name:"Jailer",             poster:"https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg" },
  { id:"tt14539740",name:"Leo",                poster:"https://image.tmdb.org/t/p/w500/jTiDY0tkMBkTHiJRXj9HaA8dBX1.jpg" },
  { id:"tt9032398", name:"Thiruchitrambalam",  poster:"https://image.tmdb.org/t/p/w500/zqFvd15pRhTrmrXLVQ5R6T5x4CW.jpg" },
  { id:"tt15671028",name:"Viduthalai",         poster:"https://image.tmdb.org/t/p/w500/2eMGd1KFXHF0lGmyMfNHAe8Zyze.jpg" },
];

const SEED_SERIES = [
  { id:"tt8291224", name:"Suzhal – The Vortex",poster:"https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg" },
  { id:"tt14519434",name:"Vadhandhi",          poster:"https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg" },
  { id:"tt9032401", name:"Navarasa",           poster:"https://image.tmdb.org/t/p/w500/2oCqDJ2JXfKVVqXdDr2A6wRKfQ7.jpg" },
];

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip   = parseInt(extra.skip || 0);
  const page   = Math.floor(skip / 20) + 1;
  const genre  = extra.genre || null;
  const search = extra.search || null;
  const platform = catalogId.split("_")[0];

  if (!TMDB_KEY) {
    const seed = type === "movie" ? SEED_MOVIES : SEED_SERIES;
    return seed.slice(skip, skip + 20).map(m => ({ ...m, type }));
  }

  if (search) return searchTamil(type, search, page);
  return discoverTamil(type, platform, page, genre);
}

module.exports = { fetchCatalog };
