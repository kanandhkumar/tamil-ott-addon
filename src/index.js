const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

// 1. Manifest Definition
const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.4.2",
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

// 2. Metadata Fetcher (TMDB)
async function getMeta(imdbId, type) {
  if (!TMDB_KEY) return null;
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = (type === "movie" ? data.movie_results : data.tv_results)?.[0];
    if (!r) return null;
    return {
      id: imdbId, type: type, name: r.title || r.name,
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
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  // Guaranteed Test IDs
  const FALLBACK = {
    netflix: ["tt30141680"], // Maharaja
    prime: ["tt31281232"],   // Raayan
    sunnxt: ["tt17057710"],  // Thiruchitrambalam
    aha: ["tt13647612"]      // Chitha
  };

  const ids = FALLBACK[platform] || ["tt30141680"];
  const metas = await Promise.all(ids.map(id => getMeta(id, req.params.type)));
  
  res.json({ metas: metas.filter(Boolean) });
});

// 4. Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));