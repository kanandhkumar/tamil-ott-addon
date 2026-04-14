const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;

console.log("WATCHMODE_KEY exists:", !!WATCHMODE_KEY);
console.log("TMDB_KEY exists:", !!TMDB_KEY);

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "4.2.1",
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

async function getWatchmodeIDs(platform, wmType) {
  if (!WATCHMODE_KEY) return [];

  const sourceMap = {
    netflix: 203,
    prime: 26,
    sunnxt: 433,
    zee5: 450,
    sonyliv: 459,
    jiohotstar: 447
  };

  const sourceId = sourceMap[platform];
  if (!sourceId) return [];

  try {
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&types=${wmType}&regions=IN&limit=12`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.titles || !Array.isArray(data.titles)) return [];

    return data.titles
      .map(t => t.imdb_id)
      .filter(id => typeof id === "string" && id.startsWith("tt"));
  } catch (e) {
    console.log(`Watchmode error for ${platform}:`, e.message);
    return [];
  }
}

async function discoverTMDB(type) {
  if (!TMDB_KEY) return [];

  try {
    const tmdbType = type === "movie" ? "movie" : "tv";
    const url = `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&sort_by=popularity.desc`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter(item => item.poster_path)
      .slice(0, 12)
      .map(item => ({
        id: `tmdb:${tmdbType}:${item.id}`,
        type,
        name: item.title || item.name || "",
        poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
        background: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : undefined,
        description: item.overview || ""
      }));
  } catch (e) {
    console.log("TMDB discover error:", e.message);
    return [];
  }
}

async function getMeta(imdbId, typ
