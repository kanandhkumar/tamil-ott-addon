const express = require("express");
const fetch = require("node-fetch");
const pLimit = require("p-limit");

const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;
const PORT = process.env.PORT || 10000;

// --- CONFIG ---
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_ITEMS = 1000;
const FETCH_TIMEOUT_MS = 7000;
const MAX_CONCURRENCY = 8;
const WATCHMODE_LIMIT = 100;
const META_RESOLVE_LIMIT = 40;
const TMDB_FALLBACK_LIMIT = 25;
const DEFAULT_REGION = "IN";

const cache = new Map();

// --- CACHE HELPERS ---
function setCache(key, value) {
  if (cache.size >= CACHE_MAX_ITEMS) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

// --- ASYNC WRAPPER ---
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// --- NETWORK HELPER ---
async function fetchJson(url, label, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// --- WATCHMODE IDS ---
async function getWatchmodeIDs(platform, wmType, region = DEFAULT_REGION) {
  const sourceMap = {
    netflix: 203,
    prime: 26,
    sunnxt: 433,
    zee5: 450,
    sonyliv: 459,
    jiohotstar: 447
  };

  const sourceId = sourceMap[platform];
  if (!sourceId || !WATCHMODE_KEY) return [];

  const cacheKey = `wm:${platform}:${wmType}:${region}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `https://api.watchmode.com/v1/list-titles/` +
      `?apiKey=${WATCHMODE_KEY}` +
      `&source_ids=${sourceId}` +
      `&types=${wmType}` +
      `&regions=${encodeURIComponent(region)}` +
      `&limit=${WATCHMODE_LIMIT}`;

    const data = await fetchJson(url, `Watchmode ${platform}`);

    const ids = [...new Set(
      (data.titles || [])
        .map(t => t.imdb_id)
        .filter(id => typeof id === "string" && id.startsWith("tt"))
    )];

    console.log(`[Watchmode] ${platform}/${wmType}/${region}: ${ids.length} IMDb IDs`);
    setCache(cacheKey, ids);
    return ids;
  } catch (e) {
    console.error(`[Watchmode Error] ${platform}:`, e.message);
    return [];
  }
}

// --- TMDB META ---
async function getMeta(imdbId, type) {
  const cacheKey = `meta:${type}:${imdbId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!TMDB_KEY || !imdbId) return null;

  try {
    const url =
      `https://api.themoviedb.org/3/find/${imdbId}` +
      `?api_key=${TMDB_KEY}` +
      `&external_source=imdb_id`;

    const data = await fetchJson(url, `TMDB find ${imdbId}`);
    const result = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

    if (!result) return null;

    const meta = {
      id: imdbId,
      type,
      name: result.title || result.name || "",
      poster: result.poster_path
        ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
        : undefined,
      background: result.backdrop_path
        ? `https://image.tmdb.org/t/p/original${result.backdrop_path}`
        : undefined,
      description: result.overview || ""
    };

    setCache(cacheKey, meta);
    return meta;
  } catch (e) {
    console.error(`[TMDB Meta Error] ${imdbId}:`, e.message);
    return null;
  }
}

// --- TMDB DISCOVER FALLBACK ---
async function discoverTMDB(type, region = DEFAULT_REGION) {
  const cacheKey = `discover:${type}:${region}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!TMDB_KEY) return [];

  try {
    const tmdbType = type === "movie" ? "movie" : "tv";
    const url =
      `https://api.themoviedb.org/3/discover/${tmdbType}` +
      `?api_key=${TMDB_KEY}` +
      `&with_original_language=ta` +
      `&region=${encodeURIComponent(region)}` +
      `&sort_by=popularity.desc`;

    const data = await fetchJson(url, `TMDB discover ${type}`);

    const limit = pLimit(MAX_CONCURRENCY);
    const metas = await Promise.all(
      (data.results || []).slice(0, TMDB_FALLBACK_LIMIT).map(item =>
        limit(async () => {
          try {
            const idsUrl =
              `https://api.themoviedb.org/3/${tmdbType}/${item.id}/external_ids` +
              `?api_key=${TMDB_KEY}`;

            const idsData = await fetchJson(idsUrl, `TMDB external_ids ${item.id}`);
            if (!idsData?.imdb_id) return null;

            return await getMeta(idsData.imdb_id, type);
          } catch (e) {
            console.error(`[TMDB Discover Item Error] ${item.id}:`, e.message);
            return null;
          }
        })
      )
    );

    const results = [...new Map(metas.filter(Boolean).map(m => [m.id, m])).values()];
    setCache(cacheKey, results);
    return results;
  } catch (e) {
    console.error(`[TMDB Discover Error] ${type}:`, e.message);
    return [];
  }
}

// --- MANIFEST ---
const manifest = {
  id: "com.kanandhkumar.tamilott",
  version: "4.5.0",
  name: "Tamil OTT Pro",
  description: "Tamil movies on Netflix, Prime, SunNXT, ZEE5, SonyLIV and JioHotstar.",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
    { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
    { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
    { id: "zee5_movies", type: "movie", name: "ZEE5 - Tamil" },
    { id: "sonyliv_movies", type: "movie", name: "SonyLIV - Tamil" },
    { id: "jiohotstar_movies", type: "movie", name: "JioHotstar - Tamil" }
  ],
  idPrefixes: ["tt"]
};

// --- ROUTES ---
app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", asyncHandler(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");

  const { type, id } = req.params;
  const platform = id.split("_")[0].toLowerCase();
  const region = (req.query.region || DEFAULT_REGION).toUpperCase();
  const wmType = type === "movie" ? "movie" : "tv_series";

  console.log(`[Request] platform=${platform} type=${type} region=${region}`);

  const ids = await getWatchmodeIDs(platform, wmType, region);

  if (ids.length > 0) {
    const limitedIds = ids.slice(0, META_RESOLVE_LIMIT);
    const limit = pLimit(MAX_CONCURRENCY);

    const metas = await Promise.all(
      limitedIds.map(imdbId => limit(() => getMeta(imdbId, type)))
    );

    const results = [...new Map(metas.filter(Boolean).map(m => [m.id, m])).values()];
    console.log(`[Response] ${platform}: ${results.length} titles from Watchmode+TMDB`);
    return res.json({ metas: results });
  }

  console.log(`[Fallback] ${platform}: Watchmode empty, using TMDB discover`);
  const fallback = await discoverTMDB(type, region);
  return res.json({ metas: fallback });
}));

app.get("/", (req, res) => {
  res.status(200).send("Tamil OTT Pro 4.5.0 is online. Add /manifest.json to Stremio.");
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err.message);
  res.status(500).json({ metas: [], error: "Internal Server Error" });
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Tamil OTT Pro 4.5.0 running on port ${PORT}`);
});