const express = require("express");
const fetch = require("node-fetch");
const app = express();

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.9.0",
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

// IMPROVED: This function now waits properly for the data
async function getMeta(imdbId, type) {
  try {
    const response = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const data = await response.json();
    
    if (data && data.meta) {
      return {
        id: imdbId,
        type: type,
        name: data.meta.name || "Tamil Movie",
        poster: data.meta.poster || "",
        background: data.meta.background || "",
        description: data.meta.description || ""
      };
    }
    return null;
  } catch (e) {
    console.error("Meta fetch failed for:", imdbId);
    return null;
  }
}

app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(manifest);
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = req.params.type;
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  const FALLBACK = {
    netflix: ["tt30141680"], // Maharaja
    prime: ["tt31281232"],   // Raayan
    sunnxt: ["tt17057710"],  // Thiruchitrambalam
    aha: ["tt13647612"]      // Chitha
  };

  const ids = FALLBACK[platform] || ["tt30141680"];
  
  // CRITICAL FIX: We use Promise.all to make sure we wait for ALL data
  const metas = await Promise.all(
    ids.map(id => getMeta(id, type))
  );

  // Filter out any nulls and send the full objects
  res.json({ metas: metas.filter(m => m !== null) });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
