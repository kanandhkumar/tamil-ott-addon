const express = require("express");
const fetch = require("node-fetch");
const app = express();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog (Pro)",
  version: "4.1.0",
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
};

// 1. Watchmode: Fetching Real Data with your IDs
async function getLiveIDs(platform, type) {
  if (!WATCHMODE_KEY) return null;
  
  // Mapping your provided IDs
  const sourceMap = { 
    netflix: 203, 
    prime: 26, 
    sunnxt: 433, 
    zee5: 450, 
    sonyliv: 459, 
    jiohotstar: 447 
  };
  
  const sourceId = sourceMap[platform];
  if (!sourceId) return null;

  try {
    // We add 'search_field=name&search_value=Tamil' as a hint if the API supports it, 
    // but filtering by source + region IN is usually enough for these platforms.
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&types=${type}&regions=IN`;
    const res = await fetch(url);
    const data = await res.json();
    
    return data.titles ? data.titles.slice(0, 10).map(t => t.imdb_id).filter(id => id) : null;
  } catch (e) {
    console.error("Watchmode Error:", e);
    return null;
  }
}

// 2. Gemini 3: Smart Backup (Optional/Fallback)
async function askGemini(platform, type) {
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `List 5 IMDb IDs for Tamil ${type}s on ${platform} India. JSON array only.` }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(text);
  } catch (e) { return null; }
}

// 3. Metadata Engine (TMDB with Cinemeta Fallback)
async function getMeta(imdbId, type) {
  try {
    if (TMDB_KEY) {
      const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;
      const tmdbRes = await fetch(tmdbUrl);
      const tmdbData = await tmdbRes.json();
      const result = type === "movie" ? tmdbData.movie_results?.[0] : tmdbData.tv_results?.[0];

      if (result && result.poster_path) {
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
    // Final check for posters via Cinemeta
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
  const type = req.params.type === "movie" ? "movie" : "tv_series";
  const platform = req.params.id.split("_")[0].toLowerCase();

  // 1. Get IDs (Watchmode -> Gemini -> Static)
  let ids = await getLiveIDs(platform, type);
  if (!ids || ids.length === 0) ids = await askGemini(platform, req.params.type);
  if (!ids || ids.length === 0) ids = ["tt30141680"]; // Maharaja as safety

  // 2. Map to Metadata
  const metas = await Promise.all(ids.map(id => getMeta(id, req.params.type)));
  res.json({ metas: metas.filter(m => m !== null && m.poster) });
});

app.get("/", (req, res) => res.send("Tamil OTT 4.1 Live with Watchmode."));

const PORT = process.env.PORT || 10000;
app.listen(PORT);
