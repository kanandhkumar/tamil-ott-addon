const express = require("express");
const fetch = require("node-fetch");
const app = express();

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.8.0",
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

// Fetches movie details so you don't get grey boxes
async function getMeta(imdbId, type) {
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const data = await res.json();
    return data.meta ? {
      id: imdbId,
      type: type,
      name: data.meta.name,
      poster: data.meta.poster,
      description: data.meta.description
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
  
  const FALLBACK = {
    netflix: ["tt30141680"], prime: ["tt31281232"], 
    sunnxt: ["tt17057710"], aha: ["tt13647612"]
  };

  const ids = FALLBACK[platform] || ["tt30141680"];
  const metas = [];
  for (const id of ids) {
    const m = await getMeta(id, type);
    if (m) metas.push(m);
  }
  res.json({ metas });
});

app.listen(process.env.PORT || 10000);
