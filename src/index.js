const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.4.5",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
    { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
    { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
    { id: "aha_movies", type: "movie", name: "Aha Tamil - Movies" }
  ],
  idPrefixes: ["tt"]
};

// Simplified TMDB Fetcher
async function getMeta(imdbId) {
  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data.movie_results?.[0];
    if (!r) return null;
    return {
      id: imdbId,
      type: "movie",
      name: r.title,
      poster: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
      description: r.overview
    };
  } catch (e) { return null; }
}

app.get("/manifest.json", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(manifest);
});

app.get("/catalog/movie/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Clean the ID (e.g., netflix_tamil becomes netflix)
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  const FALLBACK = {
    netflix: ["tt30141680"], // Maharaja
    prime: ["tt31281232"],   // Raayan
    sunnxt: ["tt17057710"],  // Thiruchitrambalam
    aha: ["tt13647612"]      // Chitha
  };

  // Get IDs for this platform, or default to Maharaja if platform not found
  const ids = FALLBACK[platform] || ["tt30141680"];
  
  const metas = await Promise.all(ids.map(id => getMeta(id)));
  const cleanMetas = metas.filter(Boolean);

  // ULTIMATE FIX: If TMDB fails, send the data manually so the row isn't empty
  if (cleanMetas.length === 0) {
    return res.json({ metas: [{
      id: "tt30141680",
      type: "movie",
      name: "Maharaja (Loading Error)",
      poster: "https://image.tmdb.org/t/p/w500/94Y9U6_test_poster.jpg"
    }]});
  }

  res.json({ metas: cleanMetas });
});

app.listen(process.env.PORT || 10000);
