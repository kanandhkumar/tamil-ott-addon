const express = require("express");
const fetch = require("node-fetch");
const app = express();

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "3.1.0",
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

/**
 * 1. Gemini 3 AI Search
 * Uses a highly specific prompt to prevent hallucinations like "Mexico".
 */
async function askGemini(platform, type) {
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Act as a Stremio metadata expert. Provide a JSON array of 5 valid IMDb IDs for high-rated Tamil ${type}s currently streaming on ${platform} India. 
            Rules:
            - Must be strictly Tamil language content.
            - Do NOT include random titles or non-Tamil content.
            - Ensure they are ${type}s, not individual episodes.
            - Return ONLY the JSON array of strings.` 
          }] 
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini Precision Error:", e);
    return null;
  }
}

/**
 * 2. Metadata Fetcher
 * Optimized TMDB lookup with Cinemeta fallback and Metahub poster generation.
 */
async function getMeta(imdbId, type) {
  try {
    // Attempt TMDB lookup first for high-quality posters
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

    // Fallback to Cinemeta/Metahub if TMDB doesn't have the ID
    const cinemetaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const cinemetaData = await cinemetaRes.json();
    if (cinemetaData.meta) {
      return {
        id: imdbId,
        type: type,
        name: cinemetaData.meta.name,
        poster: cinemetaData.meta.poster || `https://images.metahub.space/poster/medium/${imdbId}/img`,
        description: cinemetaData.meta.description
      };
    }
    return null;
  } catch (e) { 
    return null; 
  }
}

/**
 * 3. Express Routes
 */
app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.params.type;
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  // Hardcoded backups if AI fails
  const FALLBACK = {
    netflix: ["tt30141680", "tt21069722"], 
    prime: ["tt31281232", "tt15327088"], 
    sunnxt: ["tt17057710"], 
    aha: ["tt13647612"]
  };

  let ids = await askGemini(platform, type);
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    ids = FALLBACK[platform] || ["tt30141680"];
  }

  const metas = await Promise.all(ids.map(id => getMeta(id, type)));
  res.json({ metas: metas.filter(m => m !== null) });
});

// Root help page
app.get("/", (req, res) => {
  res.send("Tamil OTT Addon is active. Use /manifest.json to install in Stremio.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
