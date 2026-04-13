const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

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

const manifest = {
  id: "com.kanand.tamilott",
  version: "1.0.0",
  name: "Tamil OTT",
  description: "Tamil OTT catalogs from TMDb + IMDb IDs",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "sunnxt_movies", name: "SunNXT Movies" },
    { type: "movie", id: "aha_movies", name: "Aha Movies" },
    { type: "movie", id: "zee5_movies", name: "ZEE5 Movies" },
    { type: "movie", id: "sonyliv_movies", name: "SonyLIV Movies" },
    { type: "movie", id: "jiohotstar_movies", name: "JioHotstar Movies" },
    { type: "series", id: "sunnxt_series", name: "SunNXT Series" },
    { type: "series", id: "aha_webseries", name: "Aha Web Series" }
  ]
};

const builder = new addonBuilder(manifest);
const metaCache = new Map();

async function tmdbFindByImdb(imdbId) {
  if (!TMDB_KEY) return null;
  const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function toMetaObject(r, imdbId, type) {
  if (!r) return null;

  return {
    id: imdbId,
    type,
    name: r.title || r.name || "Unknown",
    poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
    background: r.backdrop_path ? `${TMDB_BACKDROP}${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    posterShape: "poster"
  };
}

async function getMetaByImdb(imdbId, type) {
  const cacheKey = `${type}:${imdbId}`;
  if (metaCache.has(cacheKey)) return metaCache.get(cacheKey);

  const data = await tmdbFindByImdb(imdbId);
  if (!data) return null;

  const result =
    type === "movie"
      ? (data.movie_results && data.movie_results[0])
      : (data.tv_results && data.tv_results[0]);

  const meta = toMetaObject(result, imdbId, type);
  if (meta) metaCache.set(cacheKey, meta);
  return meta;
}

builder.defineCatalogHandler(async ({ id, type, extra }) => {
  const ids = PLATFORM_DATA[id] || [];
  const skip = parseInt((extra && extra.skip) || 0, 10);
  const selected = ids.slice(skip, skip + 20);

  const metas = await Promise.all(selected.map(imdbId => getMetaByImdb(imdbId, type)));
  return { metas: metas.filter(Boolean) };
});

builder.defineMetaHandler(async ({ id, type }) => {
  const meta = await getMetaByImdb(id, type);
  if (!meta) return { meta: null };
  return { meta };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
