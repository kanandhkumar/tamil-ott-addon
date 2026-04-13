const express = require("express");
const fetch = require("node-fetch");
const app = express();

const WATCHMODE_KEY = process.env.WATCHMODE_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

const manifest = {
  id: "com.kanand.tamilott.full",
  name: "Tamil OTT",
  version: "4.2.0",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { id: "netflix", type: "movie", name: "Netflix Movies" },
    { id: "prime", type: "movie", name: "Prime Video Movies" },
    { id: "zee5", type: "movie", name: "ZEE5 Movies" },
    { id: "sunnxt", type: "movie", name: "SunNXT Movies" },
    { id: "sonyliv", type: "movie", name: "SonyLIV Movies" },
    { id: "jiohotstar", type: "movie", name: "JioHotstar Movies" }
  ],
  idPrefixes: ["tt"]
};

const SOURCE_IDS = {
  netflix: "203",
  prime: "26",
  zee5: "450",
  sunnxt: "433",
  sonyliv: "459",
  jiohotstar: "447"
};

async function getWatchmodeTitles(sourceId, type, limit = 20) {
  if (!WATCHMODE_KEY) return [];

  try {
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&source_country=IN&types=${type}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.titles || [];
  } catch (e) {
    console.log(`Watchmode error for ${sourceId}:`, e.message);
    return [];
  }
}

async function getTMDBMeta(imdbId, type) {
  if (!TMDB_KEY || !imdbId || !imdbId.startsWith('tt')) return null;

  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    const res = await fetch(url);
    const data = await res.json();

    const result = type === "movie" ? data.movie_results?.[0] : data.tv_results?.[0];
    if (!result) return null;

    return {
      id: imdbId,
      type,
      name: result.title || result.name || "",
      poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      background: result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : undefined,
      description: result.overview || ""
    };
  } catch (e) {
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
  const catalogId = req.params.id;
  const sourceId = SOURCE_IDS[catalogId];

  if (!sourceId) {
    return res.json({ metas: [] });
  }

  console.log(`Fetching ${type} from Watchmode source ${sourceId} (${catalogId})`);
  
  const titles = await getWatchmodeTitles(sourceId, type);
  const metas = await Promise.all(
    titles.slice(0, 20).map(title => getTMDBMeta(title.imdb_id, type))
  );

  const validMetas = metas.filter(m => m && m.name && m.name.length > 0);
  console.log(`Found ${validMetas.length} valid titles for ${catalogId}`);

  res.json({ metas: validMetas });
});

app.get("/", (req, res) => {
  res.send(`
    Tamil OTT v4.2 ✅<br>
    Netflix=203 | Prime=26 | ZEE5=450 | SunNXT=433 | SonyLIV=459 | JioHotstar=447<br>
    /manifest.json - Stremio manifest<br>
    /catalog/movie/netflix.json - Test Netflix
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Tamil OTT addon running on port ${PORT}`);
});
