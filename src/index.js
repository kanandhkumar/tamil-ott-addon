const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.4.3",
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

// 1. Gemini Search Logic
async function askGemini(platform, type) {
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Return a JSON array of IMDB IDs for popular Tamil ${type} on ${platform} India. Example: ["tt30141680"]` }] }]
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { return null; }
}

// 2. TMDB Metadata Logic
async function getMeta(imdbId, type) {
  if (!TMDB_KEY) return null;
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = (type === "movie" ? data.movie_results : data.tv_results)?.[0];
    if (!r) return null;
    return {
      id: imdbId, type, name: r.title || r.name,
      poster: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
      description: r.overview
    };
  } catch (e) { return null; }
}

// 3. Routes
app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.params.type;
  const platformId = req.params.id.toLowerCase();
  
  // Hardcoded Fallbacks for testing
  const FALLBACK = {
    netflix: ["tt30141680"], // Maharaja
    prime: ["tt31281232"],   // Raayan
    sunnxt: ["tt17057710"],  // Thiruchitrambalam
    aha: ["tt13647612"]      // Chitha
  };

  // Extract platform (e.g., "netflix" from "netflix_tamil")
  const platform = platformId.split("_")[0];
  
  // Try Gemini first
  let ids = await askGemini(platform, type);
  
  // If Gemini fails, use the hardcoded list
  if (!ids || ids.length === 0) {
    ids = FALLBACK[platform] || ["tt30141680"];
  }

  const metas = await Promise.all(ids.map(id => getMeta(id, type)));
  res.json({ metas: metas.filter(Boolean) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
