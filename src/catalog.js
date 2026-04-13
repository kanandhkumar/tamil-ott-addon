const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

// ── Fallback Tamil IMDB IDs (used when Gemini fails) ─────────────────────────
const FALLBACK_MOVIES = [
  "tt6016236","tt15655792","tt14539740","tt13121618","tt8143610",
  "tt7144870","tt10399902","tt9019536","tt8367814","tt6712648",
  "tt9764938","tt8108198","tt7504726","tt9032400","tt6719968",
  "tt9032398","tt15671028","tt12412888","tt16365614","tt11035246",
  "tt10837246","tt3263904","tt13700266","tt15854528","tt14899400",
  "tt15245574","tt14161718","tt21974964","tt16538956","tt5078116",
];

const FALLBACK_SERIES = [
  "tt8291224","tt14519434","tt9032401","tt12077116","tt15256628",
  "tt14444952","tt11847842","tt10954984","tt13615776","tt8291220",
  "tt22022452","tt13860938","tt14053822","tt12503248","tt10166622",
];

// Rotate fallback so each platform looks different
function rotateFallback(arr, platform) {
  const offsets = {
    sunnxt:0, zee5:5, jiohotstar:10, aha:15,
    mxplayer:3, kalaignar:8, sonyliv:13,
  };
  const n = offsets[platform] || 0;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

// ── TMDB metadata ─────────────────────────────────────────────────────────────
const metaCache = new Map();

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

async function getMeta(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/find/${imdbId}`, { external_source: "imdb_id" });
  if (!data) return null;
  const r = (data[`${mediaType}_results`] || [])[0];
  if (!r?.poster_path) return null;
  const meta = {
    id: imdbId, type,
    name: r.title || r.name || "Unknown",
    poster: `${TMDB_IMG}${r.poster_path}`,
    background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0,4) || undefined,
    imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
  };
  metaCache.set(imdbId, meta);
  return meta;
}

async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, { query, page });
  if (!data?.results) return [];
  return data.results
    .filter(r => r.original_language === "ta" && r.poster_path)
    .slice(0, 20)
    .map(r => ({
      id: `tmdb:${r.id}`, type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
    }));
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip     = parseInt(extra.skip || 0);
  const page     = Math.floor(skip / 20) + 1;
  const search   = extra.search || null;
  const platform = catalogId.split("_")[0];
  const subtype  = catalogId.replace(`${platform}_`, "");

  if (search) return searchTamil(type, search, page);

  // ── Try Gemini first ──
  let ids = null;
  try {
    ids = await askGemini(platform, subtype);
  } catch (e) {
    console.error("[Catalog] Gemini failed:", e.message);
  }

  // ── Fallback if Gemini fails ──
  if (!ids || ids.length === 0) {
    console.log(`[Catalog] Using fallback for ${catalogId}`);
    const fallback = (subtype === "series" || subtype === "webseries")
      ? FALLBACK_SERIES : FALLBACK_MOVIES;
    ids = rotateFallback(fallback, platform);
  }

  const pageIds = ids.slice(skip, skip + 20);
  if (!pageIds.length) return [];

  if (TMDB_KEY) {
    const results = [];
    for (let i = 0; i < pageIds.length; i += 5) {
      const batch = pageIds.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(id => getMeta(id, type)));
      results.push(...batchResults.filter(Boolean));
    }
    return results;
  }

  return pageIds.map(id => ({ id, type, name: id }));
}

module.exports = { fetchCatalog };
