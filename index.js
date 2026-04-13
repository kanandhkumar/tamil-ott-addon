const express = require("express");
const fetch = require("node-fetch");
const app = express();

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.9.5",
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

// IMPROVED: Fetches full metadata and forces a poster URL
async function getMeta(imdbId, type) {
  try {
    const response = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const data = await response.json();
    const meta = data.meta;

    if (meta) {
      return {
        id: imdbId,
        type: type,
        name: meta.name || "Tamil Movie",
        // Logic: Use Cinemeta poster, OR fallback to Metahub, OR use a placeholder
        poster: meta.poster || `https://images.metahub.space/poster/medium/${imdbId}/img` || "https://via.placeholder.com/500x750?text=No+Poster",
        background: meta.background || "",
        description: meta.description || "Tamil movie content."
      };
    }
    return null;
  } catch (e) {
    console.error("Fetch failed for:", imdbId);
    return null;
  }
}

app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const type = req.params.type;
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  // Static list to ensure the rows are never empty
  const FALLBACK = {
    netflix: ["tt30141680"], // Maharaja
    prime: ["tt31281232"],   // Raayan
    sunnxt: ["tt17057710"],  // Thiruchitrambalam
    aha: ["tt13647612"]      // Chitha
  };

  const ids = FALLBACK[platform] || ["tt30141680"];
  
  // Fetch all metadata in parallel
  const metas = await Promise.all(
    ids.map(id => getMeta(id, type))
  );

  res.json({ metas: metas.filter(m => m !== null) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
