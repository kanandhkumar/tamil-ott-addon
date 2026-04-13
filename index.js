const express = require("express");
const fetch = require("node-fetch");
const app = express();

const WATCHMODE_KEY = process.env.WATCHMODE_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

const manifest = {
  id: "com.kanand.tamilott.watchmode",
  name: "Tamil OTT",
  version: "4.0.0",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { id: "zee5", type: "movie", name: "ZEE5 Movies" },
    { id: "sunnxt", type: "movie", name: "SunNXT Movies" },
    { id: "sonyliv", type: "movie", name: "SonyLIV Movies" },
    { id: "aha", type: "series", name: "Aha Series" }
  ],
  idPrefixes: ["tt"]
};

// Watchmode source IDs (you'll need to verify these in their /sources endpoint)
const SOURCE_IDS = {
  zee5: "zee5",        // Replace with actual Watchmode source ID
  sunnxt: "sunnxt",    // Replace with actual Watchmode source ID  
  sonyliv: "sonyliv",  // Replace with actual Watchmode source ID
  aha: "aha"           // Replace with actual Watchmode source ID
};

async function getWatchmodeCatalog(sourceId, type, limit = 20) {
  if (!WATCHMODE_KEY) return [];

  try {
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&source_country=IN&types=${type}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();

    return data.titles || [];
  } catch {
    return [];
  }
}

async function getTMDBMeta(imdbId, type) {
  if (!TMDB_KEY || !imdbId.startsWith('tt')) return null;

  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    const res = await fetch(url);
    const data = await res.json();

    const result = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];
    if (!result) return null;

    return {
      id: imdbId,
      type,
      name: result.title || result.name,
      poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      background: result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : undefined,
      description: result.overview
    };
  } catch {
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
  const sourceId = SOURCE_IDS[req.params.id];

  if (!sourceId) {
    return res.json({ metas: [] });
  }

  const titles = await getWatchmodeCatalog(sourceId, type);
  const metas = await Promise.all(
    titles.slice(0, 20).map(title => getTMDBMeta(title.imdb_id, type))
  );

  res.json({ metas: metas.filter(Boolean) });
});

app.get("/", (req, res) => res.send("Tamil OTT with Watchmode + TMDb"));

const PORT = process.env.PORT || 10000;
app.listen(PORT);
