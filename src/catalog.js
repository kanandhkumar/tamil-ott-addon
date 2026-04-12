const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

const GENRE_MAP = {
  Action: 28,
  Drama: 18,
  Comedy: 35,
  Thriller: 53,
  Romance: 10749,
  Horror: 27,
  Family: 10751,
  "Sci-Fi": 878,
  Animation: 16,
  Crime: 80,
  Reality: 10764,
  News: 10763,
};

const PROVIDER_IDS = {
  sunnxt: 237,
  zee5: 232,
  hotstar: 122,
  aha: 532,
  mxplayer: 515,
  kalaignar: 237,
  sonyliv: 11,
};

const SORT_BY = {
  sunnxt: "popularity.desc",
  zee5: "vote_average.desc",
  hotstar: "popularity.desc",
  aha: "primary_release_date.desc",
  mxplayer: "revenue.desc",
  kalaignar: "vote_count.desc",
  sonyliv: "vote_average.desc",
};

const YEAR_FROM = {
  sunnxt: "2022-01-01",
  zee5: "2021-01-01",
  hotstar: "2023-01-01",
  aha: "2022-01-01",
  mxplayer: "2021-01-01",
  kalaignar: "2018-01-01",
  sonyliv: "2021-01-01",
};

const imdbCache = new Map();
const discoverCache = new Map();

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getImdbId(tmdbId, mediaType) {
  const key = `${mediaType}:${tmdbId}`;
  if (imdbCache.has(key)) return imdbCache.get(key);

  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, {
    append_to_response: "external_ids",
  });

  const imdbId = data?.external_ids?.imdb_id || null;
  if (imdbId) imdbCache.set(key, imdbId);
  return imdbId;
}

function buildMeta(r, type, mediaType, imdbId) {
  return {
    id: imdbId,
    type,
    name: r.title || r.name || "Unknown",
    poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
    background: r.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`
      : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    imdbRating: typeof r.vote_average === "number"
      ? r.vote_average.toFixed(1)
      : undefined,
  };
}

async function toMeta(r, type, mediaType) {
  if (!r?.poster_path) return null;
  if (r.original_language !== "ta") return null;

  const imdbId = await getImdbId(r.id, mediaType);
  if (!imdbId) return null;

  return buildMeta(r, type, mediaType, imdbId);
}

async function discoverTamil(type, platform, page, genre) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const cacheKey = `${platform}:${type}:${page}:${genre || ""}`;
  if (discoverCache.has(cacheKey)) return discoverCache.get(cacheKey);

  const baseParams = {
    page,
    with_original_language: "ta",
    sort_by: SORT_BY[platform] || "popularity.desc",
    "vote_count.gte": 10,
  };

  const providerId = PROVIDER_IDS[platform];
  if (providerId) {
    baseParams.with_watch_providers = providerId;
    baseParams.watch_region = "IN";
  }

  if (genre && GENRE_MAP[genre]) {
    baseParams.with_genres = GENRE_MAP[genre];
  }

  const yearFrom = YEAR_FROM[platform];
  if (yearFrom) {
    baseParams[mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte"] = yearFrom;
  }

  let data = await tmdbGet(`/discover/${mediaType}`, baseParams);

  if (!data?.results?.length) {
    const fallbackParams = { ...baseParams };
    delete fallbackParams.with_watch_providers;
    delete fallbackParams.watch_region;
    data = await tmdbGet(`/discover/${mediaType}`, fallbackParams);
  }

  if (!data?.results?.length) return [];

  const items = data.results
    .filter(r => r.original_language === "ta" && r.poster_path)
    .slice(0, 20);

  const out = [];
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map(r => toMeta(r, type, mediaType)));
    out.push(...batchResults.filter(Boolean));
  }

  discoverCache.set(cacheKey, out);
  setTimeout(() => discoverCache.delete(cacheKey), 30 * 60 * 1000);

  return out;
}

async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, { query, page });

  if (!data?.results?.length) return [];

  const items = data.results
    .filter(r => r.original_language === "ta" && r.poster_path)
    .slice(0, 10);

  const results = await Promise.all(items.map(r => toMeta(r, type, mediaType)));
  return results.filter(Boolean);
}

const SEED_MOVIES = [
  { id: "tt6016236", name: "Vikram", poster: "https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg", releaseInfo: "2022" },
  { id: "tt8143610", name: "Master", poster: "https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg", releaseInfo: "2021" },
  { id: "tt7144870", name: "Bigil", poster: "https://image.tmdb.org/t/p/w500/5VEJlv5OQw5rlWbfUgNW9j18xwM.jpg", releaseInfo: "2019" },
  { id: "tt13121618", name: "Ponniyin Selvan: I", poster: "https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg", releaseInfo: "2022" },
  { id: "tt15655792", name: "Jailer", poster: "https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg", releaseInfo: "2023" },
];

const SEED_SERIES = [
  { id: "tt8291224", name: "Suzhal – The Vortex", poster: "https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg", releaseInfo: "2022" },
  { id: "tt14519434", name: "Vadhandhi", poster: "https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg", releaseInfo: "2022" },
  { id: "tt9032401", name: "Navarasa", poster: "https://image.tmdb.org/t/p/w500/2oCqDJ2JXfKVVqXdDr2A6wRKfQ7.jpg", releaseInfo: "2021" },
];

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip = parseInt(extra.skip || 0, 10);
  const page = Math.floor(skip / 20) + 1;
  const genre = extra.genre || null;
  const search = extra.search || null;
  const platform = catalogId.split("_")[0];

  if (!TMDB_KEY) {
    const seed = type === "movie" ? SEED_MOVIES : SEED_SERIES;
    return seed.slice(skip, skip + 20).map(m => ({
      ...m,
      type,
      poster: m.poster,
      releaseInfo: m.releaseInfo,
    }));
  }

  const results = search
    ? await searchTamil(type, search, page)
    : await discoverTamil(type, platform, page, genre);

  return results;
}

module.exports = { fetchCatalog };
