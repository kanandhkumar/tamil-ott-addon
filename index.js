const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;

const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog (TMDB Engine)",
  version: "4.2.0",
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

// 1. Watchmode: Gets the "What's on" list using your provided IDs
async function getWatchmodeIDs(platform, type) {
  if (!WATCHMODE_KEY) return null;
  const sourceMap = { 
    netflix: 203, prime: 26, sunnxt: 433, zee5: 450, sonyliv: 459, jiohotstar: 447 
  };
  const sourceId = sourceMap[platform];
  if (!sourceId) return null;

  try {
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&types=${type}&regions=IN`;
    const res = await fetch(url);
    const data = await res.json();
    // Return IDs to be processed by TMDB
    return data.titles ? data.titles.slice(0, 12).map(t => t.imdb_id).filter(id => id) : null;
  } catch (e) {
    return null;
  }
}

// 2. TMDB Discovery: The "New" Backup 
// If Watchmode fails, we use TMDB's built-in discovery to find Tamil content
async function discoverTMDB(type) {
  if (!TMDB_KEY) return [];
  try {
    const tmdbType = type === "movie" ? "movie" : "tv";
    // This finds popular Tamil language content released in India
    const url = `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&sort_by=popularity.desc`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Convert TMDB results to a format Stremio likes
    return data.results.map(item => ({
      id: item.id, // We'll handle the ID mapping in the route
      name: item.title || item.name,
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      description: item.overview,
      type: type
    }));
  } catch (e) {
    return [];
  }
}

// 3. Metadata Fetcher
async function getMeta(imdbId, type) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    const res = await fetch(tmdbUrl);
    const data = await res.json();
    const result = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];

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
    return null;
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
  const wmType = type === "movie" ? "movie" : "tv_series";

  // Priority 1: Watchmode (Specific to the App)
  let ids = await getWatchmodeIDs(platform, wmType);
  
  if (ids && ids.length > 0) {
    const metas = await Promise.all(ids.map(id => getMeta(id, type)));
    return res.json({ metas: metas.filter(m => m !== null) });
  }

  // Priority 2: TMDB Discovery (General Tamil Content if Watchmode is empty)
  const discoveryResults = await discoverTMDB(type);
  res.json({ metas: discoveryResults });
});

app.get("/", (req, res) => res.send("Tamil OTT 4.2: TMDB Engine Active."));

const PORT = process.env.PORT || 10000;
app.listen(PORT);
