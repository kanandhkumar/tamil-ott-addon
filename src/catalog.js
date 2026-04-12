const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const GENRE_MAP = {
  Action:28, Drama:18, Comedy:35, Thriller:53, Romance:10749,
  Horror:27, Family:10751, "Sci-Fi":878, Animation:16, Crime:80,
  Reality:10764, News:10763,
};

// TMDB watch provider IDs for India
const PROVIDER_IDS = {
  sunnxt:    237,
  zee5:      232,
  hotstar:   122,
  aha:       532,
  mxplayer:  515,
  kalaignar: 237,
  sonyliv:   11,
};

// Sort strategies per platform to give different ordering
const SORT_BY = {
  sunnxt:    "popularity.desc",
  zee5:      "vote_average.desc",
  hotstar:   "popularity.desc",
  aha:       "primary_release_date.desc",
  mxplayer:  "revenue.desc",
  kalaignar: "vote_count.desc",
  sonyliv:   "vote_average.desc",
};

// Year range offsets so platforms show different eras
const YEAR_FILTERS = {
  sunnxt:    { from: "2022-01-01" },
  zee5:      { from: "2023-01-01" },
  hotstar:   { from: "2023-01-01" },
  aha:       { from: "2022-01-01" },
  mxplayer:  { from: "2021-01-01" },
  kalaignar: { from: "2018-01-01", to: "2024-12-31" },
  sonyliv:   { from: "2021-01-01" },
};

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

function toMeta(r, type) {
  if (!r || !r.poster_path) return null;
  // Only return Tamil language content
  if (r.original_language && r.original_language !== "ta") return null;
  return {
    id: `tmdb:${r.id}`,
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
  const providerId = PROVIDER_IDS[platform];
  const sort = SORT_BY[platform] || "popularity.desc";
  const yearFilter = YEAR_FILTERS[platform] || {};

  const params = {
    page,
    with_original_language: "ta",
    sort_by: sort,
    "vote_count.gte": 10,
  };

  if (providerId) {
    params.with_watch_providers = providerId;
    params.watch_region = "IN";
  }

  if (genre && GENRE_MAP[genre]) {
    params.with_genres = GENRE_MAP[genre];
  }

  // Date filters
  if (mediaType === "movie") {
    if (yearFilter.from) params["primary_release_date.gte"] = yearFilter.from;
    if (yearFilter.to)   params["primary_release_date.lte"] = yearFilter.to;
  } else {
    if (yearFilter.from) params["first_air_date.gte"] = yearFilter.from;
    if (yearFilter.to)   params["first_air_date.lte"] = yearFilter.to;
  }

  const data = await tmdbGet(`/discover/${mediaType}`, params);
  if (!data || !data.results) return [];
  return data.results.map(r => toMeta(r, type)).filter(Boolean);
}

async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, {
    query, page, language: "en-US",
  });
  if (!data || !data.results) return [];
  return data.results
    .filter(r => r.original_language === "ta")
    .map(r => toMeta(r, type))
    .filter(Boolean);
}

// Seed fallback when no TMDB key
const SEED = [
  { id:"tmdb:715931", type:"movie", name:"Vikram",            poster:"https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg" },
  { id:"tmdb:617802", type:"movie", name:"Master",            poster:"https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg" },
  { id:"tmdb:529929", type:"movie", name:"Bigil",             poster:"https://image.tmdb.org/t/p/w500/5VEJlv5OQw5rlWbfUgNW9j18xwM.jpg" },
  { id:"tmdb:664767", type:"movie", name:"Soorarai Pottru",   poster:"https://image.tmdb.org/t/p/w500/xBDGHXHpBJ8OPnCGGOILqbVxVOi.jpg" },
  { id:"tmdb:580666", type:"movie", name:"96",                poster:"https://image.tmdb.org/t/p/w500/4IXi9UqCcuJJI7CXC7r0T7USTpL.jpg" },
  { id:"tmdb:466272", type:"movie", name:"Mersal",            poster:"https://image.tmdb.org/t/p/w500/3nHDnE0OAT6dAOCqKUVSVBn4Dw8.jpg" },
  { id:"tmdb:791526", type:"movie", name:"Jai Bhim",          poster:"https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg" },
  { id:"tmdb:648579", type:"movie", name:"Super Deluxe",      poster:"https://image.tmdb.org/t/p/w500/7MVHvMCuLzSIhkELrxbXzLmgF0A.jpg" },
  { id:"tmdb:496243", type:"movie", name:"Ponniyin Selvan: I",poster:"https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg" },
  { id:"tmdb:855287", type:"movie", name:"Jailer",            poster:"https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg" },
  { id:"tmdb:128203", type:"series", name:"Suzhal",           poster:"https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg" },
  { id:"tmdb:210796", type:"series", name:"Vadhandhi",        poster:"https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg" },
];

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip     = parseInt(extra.skip || 0);
  const page     = Math.floor(skip / 20) + 1;
  const genre    = extra.genre || null;
  const search   = extra.search || null;
  const platform = catalogId.split("_")[0];

  if (!TMDB_KEY) {
    return SEED.filter(s => s.type === type).slice(skip, skip + 20);
  }

  if (search) {
    return searchTamil(type, search, page);
  }

  return discoverTamil(type, platform, page, genre);
}

module.exports = { fetchCatalog };
