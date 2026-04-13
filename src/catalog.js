const fetch = require("node-fetch");

const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_IMG     = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY     = process.env.TMDB_API_KEY || "";
const RAPID_KEY    = process.env.RAPIDAPI_KEY || "";
const RAPID_HOST   = "streaming-availability.p.rapidapi.com";
const RAPID_BASE   = "https://streaming-availability.p.rapidapi.com";

// Streaming Availability API service IDs for India
const SERVICE_IDS = {
  sunnxt:     "sun",
  zee5:       "zee5",
  jiohotstar: "hotstar",
  aha:        "aha",
  mxplayer:   "mxplayer",
  sonyliv:    "sonyliv",
  kalaignar:  "sun",   // closest available
};

const GENRE_MAP = {
  Action:"action", Drama:"drama", Comedy:"comedy", Thriller:"thriller",
  Romance:"romance", Horror:"horror", Family:"family", "Sci-Fi":"scifi",
  Animation:"animation", Crime:"crime",
};

// Cache per platform+type
const catalogCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function rapidGet(path, params = {}) {
  if (!RAPID_KEY) return null;
  const url = new URL(`${RAPID_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key":  RAPID_KEY,
        "x-rapidapi-host": RAPID_HOST,
      },
      timeout: 12000,
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

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

// Convert Streaming Availability show to Stremio meta
function showToMeta(show, type) {
  if (!show) return null;
  // Prefer IMDB ID so Cinemeta + Torrentio work
  const id = show.imdbId || (show.tmdbId ? `tmdb:${show.tmdbId}` : null);
  if (!id) return null;
  const poster = show.imageSet?.verticalPoster?.w480
    || show.imageSet?.verticalPoster?.w360
    || show.posterURLs?.["500"]
    || null;
  if (!poster) return null;
  return {
    id,
    type,
    name: show.title || show.originalTitle || "Unknown",
    poster,
    background: show.imageSet?.horizontalPoster?.w1440
      || show.imageSet?.horizontalPoster?.w1080 || undefined,
    description: show.overview || undefined,
    releaseInfo: show.releaseYear ? String(show.releaseYear) : undefined,
    imdbRating: show.rating ? String((show.rating / 10).toFixed(1)) : undefined,
    genres: show.genres?.map(g => g.name) || [],
  };
}

// Fetch platform-specific Tamil catalog via Streaming Availability API
async function fetchFromStreamingAPI(platform, type, page, genre) {
  const serviceId = SERVICE_IDS[platform];
  if (!serviceId) return [];

  const showType = type === "movie" ? "movie" : "series";
  const params = {
    country:   "in",
    service:   serviceId,
    type:      showType,
    language:  "ta",        // Tamil language filter
    orderBy:   "popularity_alltime",
    orderDirection: "desc",
    page:      String(page),
    output_language: "en",
  };

  if (genre && GENRE_MAP[genre]) {
    params.genre = GENRE_MAP[genre];
  }

  const data = await rapidGet("/shows/search/filters", params);
  if (!data?.shows?.length) return [];

  return data.shows.map(s => showToMeta(s, type)).filter(Boolean);
}

// Fallback: TMDB discover for Tamil content
async function tmdbDiscover(type, page, genre) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const params = {
    page,
    with_original_language: "ta",
    sort_by: "popularity.desc",
    "vote_count.gte": 10,
  };
  if (genre && GENRE_MAP[genre]) params.with_genres = genre;

  const data = await tmdbGet(`/discover/${mediaType}`, params);
  if (!data?.results) return [];

  const items = data.results.filter(r => r.original_language === "ta" && r.poster_path);
  const results = await Promise.all(items.slice(0, 20).map(async r => {
    const ext = await tmdbGet(`/${mediaType}/${r.id}/external_ids`);
    const imdbId = ext?.imdb_id;
    if (!imdbId) return null;
    return {
      id: imdbId, type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
      description: r.overview || undefined,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
      imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
    };
  }));
  return results.filter(Boolean);
}

// Seed fallback
const SEED_MOVIES = [
  { id:"tt6016236",  name:"Vikram",             poster:"https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg", releaseInfo:"2022" },
  { id:"tt8143610",  name:"Master",             poster:"https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg", releaseInfo:"2021" },
  { id:"tt13121618", name:"Ponniyin Selvan: I", poster:"https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg", releaseInfo:"2022" },
  { id:"tt15655792", name:"Jailer",             poster:"https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg", releaseInfo:"2023" },
  { id:"tt10399902", name:"Jai Bhim",           poster:"https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg", releaseInfo:"2021" },
];
const SEED_SERIES = [
  { id:"tt8291224",  name:"Suzhal",    poster:"https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg", releaseInfo:"2022" },
  { id:"tt14519434", name:"Vadhandhi", poster:"https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg", releaseInfo:"2022" },
];

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip   = parseInt(extra.skip || 0);
  const page   = Math.floor(skip / 20) + 1;
  const genre  = extra.genre || null;
  const search = extra.search || null;
  const platform = catalogId.split("_")[0];

  // No keys at all — seed fallback
  if (!RAPID_KEY && !TMDB_KEY) {
    const seed = type === "movie" ? SEED_MOVIES : SEED_SERIES;
    return seed.slice(skip, skip + 20).map(m => ({ ...m, type }));
  }

  // Search: use TMDB
  if (search) return tmdbDiscover(type, page, null);

  // Check cache
  const cacheKey = `${platform}:${type}:${page}:${genre || ""}`;
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  let results = [];

  // Try Streaming Availability API first
  if (RAPID_KEY) {
    results = await fetchFromStreamingAPI(platform, type, page, genre);
  }

  // Fallback to TMDB discover if no results
  if (!results.length && TMDB_KEY) {
    results = await tmdbDiscover(type, page, genre);
  }

  // Fallback to seed
  if (!results.length) {
    const seed = type === "movie" ? SEED_MOVIES : SEED_SERIES;
    results = seed.map(m => ({ ...m, type }));
  }

  catalogCache.set(cacheKey, { data: results, ts: Date.now() });
  return results.slice(0, 20);
}

module.exports = { fetchCatalog };
