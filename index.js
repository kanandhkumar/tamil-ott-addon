const express = require("express");
const fetch = require("node-fetch");
const pLimitModule = require("p-limit"); 

const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;
const PORT = process.env.PORT || 10000;

const CACHE_TTL_MS = 60 * 60 * 1000; 
const CACHE_MAX_ITEMS = 1000;
const MAX_CONCURRENCY = 1; // Strict serial processing to stop the 500s
const FETCH_TIMEOUT = 12000; 

const cache = new Map();
const pLimit = pLimitModule.default || pLimitModule;

async function fetchJson(url, label, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (res.ok) return await res.json();
      
      if (res.status === 500 || res.status === 429) {
        console.warn(`[Cooldown] ${label} status ${res.status}. Waiting 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        continue;
      }
      throw new Error(`Status ${res.status}`);
    } catch (e) {
      if (i === retries) return null;
    }
  }
}

function setCache(key, value) {
  if (cache.size > CACHE_MAX_ITEMS) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiresAt) return null;
  return item.value;
}

async function checkStreamingStatus(imdbId, targetSourceId) {
  const cacheKey = `avail:${imdbId}:${targetSourceId}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;

  const url = `https://api.watchmode.com/v1/title/${imdbId}/sources/?apiKey=${WATCHMODE_KEY}&regions=IN`;
  const data = await fetchJson(url, `WM ${imdbId}`);
  
  const isOnPlatform = Array.isArray(data) && data.some(s => s.source_id === targetSourceId);
  setCache(cacheKey, isOnPlatform);
  return isOnPlatform;
}

async function getTrendingTamil(type) {
  const cacheKey = `trending:${type}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const tmdbType = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_KEY}&with_original_language=ta&sort_by=popularity.desc&region=IN`;

  const data = await fetchJson(url, "TMDB Discovery");
  if (!data || !data.results) return [];

  const limit = pLimit(MAX_CONCURRENCY);
  // Reduced to Top 12 to ensure success
  const metas = await Promise.all(
    data.results.slice(0, 12).map(item =>
      limit(async () => {
        const idsUrl = `https://api.themoviedb.org/3/${tmdbType}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const idsData = await fetchJson(idsUrl, "IDs");
        if (!idsData || !idsData.imdb_id) return null;

        return {
          id: idsData.imdb_id,
          type,
          name: item.title || item.name,
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
          background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
          description: item.overview || ""
        };
      })
    )
  );

  const finalResults = metas.filter(Boolean);
  setCache(cacheKey, finalResults);
  return finalResults;
}

app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    id: "com.kanandhkumar.tamilott",
    version: "5.0.3",
    name: "Tamil OTT Pro",
    description: "Verified Tamil catalogs.",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
      { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
      { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
      { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
      { id: "zee5_movies", type: "movie", name: "ZEE5 - Tamil" },
      { id: "sonyliv_movies", type: "movie", name: "SonyLIV - Tamil" },
      { id: "jiohotstar_movies", type: "movie", name: "JioHotstar - Tamil" }
    ],
    idPrefixes: ["tt"]
  });
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");

  const { type, id } = req.params;
  const platform = id.split("_")[0];
  const sourceMap = { netflix: 203, prime: 26, sunnxt: 433, zee5: 450, sonyliv: 459, jiohotstar: 447 };
  const targetSourceId = sourceMap[platform];

  if (!targetSourceId) return res.json({ metas: [] });

  const trending = await getTrendingTamil(type);
  const limit = pLimit(MAX_CONCURRENCY);

  const metas = await Promise.all(
    trending.map(item =>
      limit(async () => {
        const isAvailable = await checkStreamingStatus(item.id, targetSourceId);
        return isAvailable ? item : null;
      })
    )
  );

  res.json({ metas: metas.filter(Boolean) });
});

app.get("/", (req, res) => res.status(200).send("Tamil OTT Pro 5.0.3 Online"));

app.listen(PORT, () => console.log(`🚀 v5.0.3 live` ));
