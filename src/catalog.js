const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";
const REGION    = "IN";

const GENRE_MAP = {
  Action:28, Drama:18, Comedy:35, Thriller:53, Romance:10749,
  Horror:27, Family:10751, "Sci-Fi":878, Animation:16, Crime:80,
  Reality:10764, News:10763,
};

// TMDB provider IDs for India
const PROVIDER_ID_MAP = {
  sunnxt:     [237],
  zee5:       [232],
  jiohotstar: [122, 1759],  // Hotstar + JioCinema (merged Feb 2025)
  aha:        [532],
  mxplayer:   [515],
  kalaignar:  [237, 232],   // Approximated via Sun/Zee
  sonyliv:    [11],
};

// Cache: platform → list of meta items
const platformCache = new Map();
const CACHE_TTL = 45 * 60 * 1000; // 45 min

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { timeout: 8000 });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// Fetch watch providers for a single title and check if it's on a given platform
async function isOnPlatform(tmdbId, mediaType, providerIds) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
  if (!data?.results?.[REGION]) return false;
  const region = data.results[REGION];
  const available = [
    ...(region.flatrate || []),
    ...(region.free || []),
    ...(region.ads || []),
  ];
  return available.some(p => providerIds.includes(p.provider_id));
}

// Get IMDB ID for a TMDB item
const imdbCache = new Map();
async function getImdbId(tmdbId, mediaType) {
  const key = `${mediaType}:${tmdbId}`;
  if (imdbCache.has(key)) return imdbCache.get(key);
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/external_ids`);
  const id = data?.imdb_id || null;
  if (id) imdbCache.set(key, id);
  return id;
}

// Discover Tamil content across multiple pages and filter by platform provider
async function buildPlatformCatalog(platform, mediaType) {
  const cacheKey = `${platform}:${mediaType}`;
  const cached = platformCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const providerIds = PROVIDER_ID_MAP[platform] || [];
  const results = [];
  const seen = new Set();

  // Fetch up to 5 pages of Tamil content
  for (let page = 1; page <= 5 && results.length < 40; page++) {
    const data = await tmdbGet(`/discover/${mediaType}`, {
      page,
      with_original_language: "ta",
      sort_by: "popularity.desc",
      "vote_count.gte": 5,
      ...(mediaType === "movie"
        ? { "primary_release_date.gte": "2015-01-01" }
        : { "first_air_date.gte": "2015-01-01" }),
    });

    if (!data?.results?.length) break;

    // Check each result for platform availability in parallel batches of 5
    const items = data.results.filter(r =>
      r.original_language === "ta" && r.poster_path && !seen.has(r.id)
    );

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      await Promise.all(batch.map(async (r) => {
        if (seen.has(r.id)) return;
        seen.add(r.id);

        const onPlatform = providerIds.length > 0
          ? await isOnPlatform(r.id, mediaType, providerIds)
          : true;

        if (!onPlatform) return;

        const imdbId = await getImdbId(r.id, mediaType);
        if (!imdbId) return;

        results.push({
          id: imdbId,
          type: mediaType === "movie" ? "movie" : "series",
          name: r.title || r.name || "Unknown",
          poster: `${TMDB_IMG}${r.poster_path}`,
          background: r.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
          description: r.overview || undefined,
          releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
          imdbRating: r.vote_average
            ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
        });
      }));

      if (results.length >= 40) break;
    }
  }

  platformCache.set(cacheKey, { data: results, ts: Date.now() });
  return results;
}

// Search Tamil content
async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, { query, page });
  if (!data?.results) return [];
  const items = data.results.filter(r => r.original_language === "ta" && r.poster_path).slice(0, 10);
  const results = await Promise.all(items.map(async r => {
    const imdbId = await getImdbId(r.id, mediaType);
    if (!imdbId) return null;
    return {
      id: imdbId,
      type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
    };
  }));
  return results.filter(Boolean);
}

// Seed fallback — real IMDB IDs
const SEED_MOVIES = [
  { id:"tt6016236",  name:"Vikram",             poster:"https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg", releaseInfo:"2022" },
  { id:"tt8143610",  name:"Master",             poster:"https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg", releaseInfo:"2021" },
  { id:"tt13121618", name:"Ponniyin Selvan: I", poster:"https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg", releaseInfo:"2022" },
  { id:"tt15655792", name:"Jailer",             poster:"https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg", releaseInfo:"2023" },
  { id:"tt10399902", name:"Jai Bhim",           poster:"https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg", releaseInfo:"2021" },
];
const SEED_SERIES = [
  { id:"tt8291224",  name:"Suzhal",   poster:"https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg", releaseInfo:"2022" },
  { id:"tt14519434", name:"Vadhandhi",poster:"https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg", releaseInfo:"2022" },
];

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip   = parseInt(extra.skip || 0);
  const genre  = extra.genre || null;
  const search = extra.search || null;
  const platform = catalogId.split("_")[0];
  const mediaType = type === "movie" ? "movie" : "tv";

  if (!TMDB_KEY) {
    const seed = type === "movie" ? SEED_MOVIES : SEED_SERIES;
    return seed.slice(skip, skip + 20).map(m => ({ ...m, type }));
  }

  if (search) return searchTamil(type, search, 1);

  // Build/fetch platform-specific catalog
  let items = await buildPlatformCatalog(platform, mediaType);

  // Genre filter
  if (genre && GENRE_MAP[genre]) {
    items = items.filter(m => m.genres && m.genres.includes(genre));
  }

  return items.slice(skip, skip + 20);
}

module.exports = { fetchCatalog };
