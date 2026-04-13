const fetch = require("node-fetch");
const { askGemini } = require("./gemini");

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

// THE GUARANTEED LIST - These will show up if Gemini fails
const FALLBACK = {
  netflix: ["tt30141680"], // Maharaja
  prime: ["tt31281232"],   // Raayan
  sunnxt: ["tt17057710"],  // Thiruchitrambalam
  aha: ["tt13647612"]      // Chitha
};

async function getMeta(imdbId, type) {
  if (!TMDB_KEY) return null;
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    const r = (type === "movie" ? data.movie_results : data.tv_results)?.[0];

    if (!r) return null;
    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
      description: r.overview
    };
  } catch (e) { return null; }
}

async function fetchCatalog(catalogId, type) {
  const platform = catalogId.split("_")[0].toLowerCase();
  
  // Try Gemini first, if it fails, use the FALLBACK list
  let ids = await askGemini(platform, type);
  if (!ids || ids.length === 0) ids = FALLBACK[platform] || ["tt30141680"];

  const results = await Promise.all(ids.map(id => getMeta(id, type)));
  return results.filter(Boolean); // Only keep items that actually have data
}

module.exports = { fetchCatalog };