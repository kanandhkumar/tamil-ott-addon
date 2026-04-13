const express = require("express");
const fetch = require("node-fetch");
const app = express();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY; // Add this to Render!

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog (Live Data)",
  version: "4.0.0",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
    { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
    { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
    { id: "aha_movies", type: "movie", name: "Aha Tamil - Movies" }
  ],
  idPrefixes: ["tt"]
};

// 1. Watchmode: Get REAL IDs for platforms in India
async function getLiveIDs(platform, type) {
  if (!WATCHMODE_KEY) return null;
  
  // Mapping Stremio IDs to Watchmode Source IDs
  const sourceMap = { 
    netflix: 203, prime: 26, sunnxt: 307, aha: 425 
  };
  const sourceId = sourceMap[platform];
  if (!sourceId) return null;

  try {
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&types=${type}&regions=IN`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Extract first 5-8 IMDb IDs from the results
    return data.titles ? data.titles.slice(0, 8).map(t => t.imdb_id).filter(id => id) : null;
  } catch (e) {
    console.error("Watchmode Error:", e);
    return null;
  }
}

// 2. Gemini 3: The "Smart Backup"
async function askGemini(platform, type) {
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `JSON array of 6 IMDB IDs for popular Tamil ${type}s on ${platform} India. ONLY the array.` }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    const data = await res.json();
    return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
  } catch (e) { return null; }
}

// 3. Metadata Fetcher (TMDB First, then Cinemeta)
async function getMeta(imdbId, type) {
  try {
    if (TMDB_KEY) {
      const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;
      const tmdbRes = await fetch(tmdbUrl);
      const tmdbData = await tmdbRes.json();
      const result = type === "movie" ? tmdbData.movie_results?.[0] : tmdbData.tv_results?.[0];

      if (result) {
        return {
          id: imdbId,
          type: type,
          name: result.title || result.name,
          poster: `https://image.tmdb.org/t/p/w500${result.poster_path}`,
          background: `https://image.tmdb.org/t/p/original${result.backdrop_path}`,
          description: result.overview
        };
      }
    }
    const cinemetaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const cinemetaData = await cinemetaRes.json();
    return cinemetaData.meta ? {
      id: imdbId,
      type: type,
      name: cinemetaData.meta.name,
      poster: cinemetaData.meta.poster || `https://images.metahub.space/poster/medium/${imdbId}/img`,
      description: cinemetaData.meta.description
    } : null;
  } catch (e) { return null; }
}

app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.params.type;
  const platform = req.params.id.split("_")[0].toLowerCase();

  // Try Watchmode first (Live data) -> Then Gemini (AI data) -> Then static fallback
  let ids = await getLiveIDs(platform, type === "series" ? "tv_series" : "movie");
  if (!ids || ids.length === 0) ids = await askGemini(platform, type);
  if (!ids || ids.length === 0) ids = ["tt30141680"]; // Maharaja

  const metas = await Promise.all(ids.map(id => getMeta(id, type)));
  res.json({ metas: metas.filter(m => m !== null && m.poster) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Version 4.0 Live`));
