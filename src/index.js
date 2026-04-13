const express = require("express");
const fetch = require("node-fetch");
const app = express();

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.5.0",
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

// 1. Gemini Search (To find what's trending)
async function askGemini(platform, type) {
  if (!GEMINI_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Return a JSON array of IMDB IDs for popular Tamil ${type} on ${platform} India. Just the IDs, e.g. ["tt30141680"]` }] }]
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { return null; }
}

// 2. Cinemeta Fetcher (NO API KEY NEEDED)
async function getMeta(imdbId, type) {
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const data = await res.json();
    if (!data.meta) return null;

    return {
      id: imdbId,
      type: type,
      name: data.meta.name,
      poster: data.meta.poster,
      background: data.meta.background,
      description: data.meta.description,
      releaseInfo: data.meta.year || data.meta.releaseInfo
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
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  const FALLBACK = {
    netflix: ["tt30141680"], 
    prime: ["tt31281232"],   
    sunnxt: ["tt17057710"],  
    aha: ["tt13647612"]      
  };

  let ids = await askGemini(platform, type);
  if (!ids || ids.length === 0) ids = FALLBACK[platform] || ["tt30141680"];

  const metas = await Promise.all(ids.map(id => getMeta(id, type)));
  res.json({ metas: metas.filter(Boolean) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
