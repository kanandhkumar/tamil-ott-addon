const express = require("express");
const fetch = require("node-fetch");
const pLimitModule = require("p-limit"); 

const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;
const PORT = process.env.PORT || 10000;

const CACHE_TTL_MS = 60 * 60 * 1000; 
const CACHE_MAX_ITEMS = 1000;
const MAX_CONCURRENCY = 1; // Extreme safety
const FETCH_TIMEOUT = 8000; 

const cache = new Map();
const pLimit = pLimitModule.default || pLimitModule;

async function fetchJson(url, label, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (res.ok) return await res.json();
      if (res.status === 500 || res.status === 429) {
        if (i < retries) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }
      }
      return null;
    } catch (e) {
      if (i === retries) return null;
    }
  }
}

async function checkStreamingStatus(imdbId, targetSourceId) {
  const cacheKey = `avail:${imdbId}:${targetSourceId}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached.value;

  const url = `https://api.watchmode.com/v1/title/${imdbId}/sources/?apiKey=${WATCHMODE_KEY}&regions=IN`;
  const data = await fetchJson(url, `WM ${imdbId}`);
  
  // If Watchmode fails (null), we assume TRUE to avoid hiding content during API outages
  const isOnPlatform = data === null ? true : data.some(s => s.source_id === targetSourceId);
  
  cache.set(cacheKey, { value: isOnPlatform, expiresAt: Date.now() + CACHE_TTL_MS });
  return isOnPlatform;
}

async function getTrendingTamil(type) {
  const tmdbType = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_KEY}&with_original_language=ta&sort_by=popularity.desc&region=IN`;
  const data = await fetchJson(url, "TMDB");
  if (!data || !data.results) return [];

  const limit = pLimit(MAX_CONCURRENCY);
  return Promise.all(
    data.results.slice(0, 15).map(item =>
      limit(async () => {
        const idsUrl = `https://api.themoviedb.org/3/${tmdbType}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const idsData = await fetchJson(idsUrl, "IDs");
        if (!idsData || !idsData.imdb_id) return null;
        return {
          id: idsData.imdb_id,
          type,
          name: item.title || item.name,
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
          description: item.overview || ""
        };
      })
    )
  ).then(results => results.filter(Boolean));
}

app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    id: "com.kanandhkumar.tamilott",
    version: "5.1.0",
    name: "Tamil OTT Survivor",
    description: "Tamil catalogs with API fail-safe protection.",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
      { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
      { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
      { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
      { id: "zee5_movies", type: "movie", name: "ZEE5 - Tamil" },
      { id: "sonyliv_movies", type: "movie", name: "SonyLIV - Tamil" },
      { id: "jiohotstar_movies", type: "movie", name: "JioHotstar - Tamil" }
    ]
  });
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { type, id } = req.params;
  const platform = id.split("_")[0];
  const sourceMap = { netflix: 203, prime: 26, sunnxt: 433, zee5: 450, sonyliv: 459, jiohotstar: 447 };
  const targetSourceId = sourceMap[platform];

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

app.listen(PORT, () => console.log("Survivor Build Live"));
