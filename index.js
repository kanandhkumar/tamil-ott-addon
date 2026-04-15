const express = require("express");
const fetch   = require("node-fetch");
const app     = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT     = process.env.PORT || 10000;

let masterList = { tMovies: [], dMovies: [], tSeries: [], dSeries: [] };

const delay = ms => new Promise(res => setTimeout(res, ms));

// ── Fetch multiple pages from TMDB ────────────────────────────────────────────
async function fetchAllPages(url, pages = 3) {
  let results = [];
  for (let p = 1; p <= pages; p++) {
    try {
      const res  = await fetch(`${url}&page=${p}`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data.results) results = results.concat(data.results);
    } catch (e) { console.error(`Page ${p} error:`, e.message); }
    await delay(200); // Be kind to TMDB rate limits
  }
  return results;
}

// ── Convert TMDB item to Stremio meta ─────────────────────────────────────────
async function convertToPlayable(item, type) {
  try {
    const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
    const res   = await fetch(idUrl, { signal: AbortSignal.timeout(6000) });
    const ids   = await res.json();
    if (!item.poster_path) return null;
    return {
      id:          ids.imdb_id || `tmdb:${item.id}`,
      name:        item.title || item.name,
      type:        type === "movie" ? "movie" : "series",
      poster:      `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      background:  item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
      description: item.overview || undefined,
      releaseInfo: (item.release_date || item.first_air_date || "").slice(0, 4) || undefined,
      imdbRating:  item.vote_average ? String(parseFloat(item.vote_average).toFixed(1)) : undefined,
    };
  } catch (e) { return null; }
}

// ── Build master list ─────────────────────────────────────────────────────────
async function updateDailyList() {
  const today     = new Date().toISOString().split("T")[0];
  const startDate = "2024-01-01";
  console.log("🌞 Refreshing Tamil catalog...");

  try {
    // Row 1: Pure Tamil Movies — original language Tamil, newest first
    const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}`
      + `&with_original_language=ta`
      + `&primary_release_date.gte=${startDate}`
      + `&primary_release_date.lte=${today}`
      + `&sort_by=primary_release_date.desc`
      + `&vote_count.gte=5`;

    // Row 2: OTT Dubbed Hits — popular movies from EN/HI/TE/ML/KN
    // released on streaming (type 4) with Tamil translation available
    // TMDB doesn't have a "dubbed" filter, so we use high-popularity
    // Indian OTT releases and trust that popular films have Tamil dubs
    const dMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}`
      + `&with_original_language=hi|te|ml|kn|en`
      + `&region=IN`
      + `&with_release_type=4`
      + `&primary_release_date.gte=${startDate}`
      + `&primary_release_date.lte=${today}`
      + `&sort_by=popularity.desc`
      + `&vote_count.gte=50`
      + `&vote_average.gte=6.0`;  // Quality filter — popular dubbed films tend to be rated

    // Row 3: Tamil Web Series — original language Tamil
    const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}`
      + `&with_original_language=ta`
      + `&first_air_date.gte=${startDate}`
      + `&first_air_date.lte=${today}`
      + `&sort_by=first_air_date.desc`
      + `&vote_count.gte=5`;

    // Row 4: Dubbed Series — popular series from other Indian languages
    const dSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}`
      + `&with_original_language=hi|te|ml|kn|en`
      + `&with_networks=8|119|337|350`  // Netflix, Amazon, Disney+, Apple TV
      + `&first_air_date.gte=${startDate}`
      + `&first_air_date.lte=${today}`
      + `&sort_by=popularity.desc`
      + `&vote_count.gte=50`
      + `&vote_average.gte=6.5`;

    const [rawTM, rawDM, rawTS, rawDS] = await Promise.all([
      fetchAllPages(tMovieUrl, 5),
      fetchAllPages(dMovieUrl, 3),
      fetchAllPages(tSeriesUrl, 5),
      fetchAllPages(dSeriesUrl, 3),
    ]);

    // Process Tamil movies
    masterList.tMovies = [];
    for (const item of rawTM.slice(0, 60)) {
      const p = await convertToPlayable(item, "movie");
      if (p) masterList.tMovies.push(p);
      await delay(50);
    }

    // Process dubbed movies (sorted newest first)
    masterList.dMovies = [];
    const sortedDM = [...rawDM].sort((a, b) =>
      new Date(b.release_date) - new Date(a.release_date)
    );
    for (const item of sortedDM.slice(0, 60)) {
      const p = await convertToPlayable(item, "movie");
      if (p) masterList.dMovies.push(p);
      await delay(50);
    }

    // Process Tamil series
    masterList.tSeries = [];
    for (const item of rawTS.slice(0, 60)) {
      const p = await convertToPlayable(item, "tv");
      if (p) masterList.tSeries.push(p);
      await delay(50);
    }

    // Process dubbed series
    masterList.dSeries = [];
    const sortedDS = [...rawDS].sort((a, b) =>
      new Date(b.first_air_date) - new Date(a.first_air_date)
    );
    for (const item of sortedDS.slice(0, 60)) {
      const p = await convertToPlayable(item, "tv");
      if (p) masterList.dSeries.push(p);
      await delay(50);
    }

    console.log(`✅ Done! Tamil Movies: ${masterList.tMovies.length} | Dubbed Movies: ${masterList.dMovies.length} | Tamil Series: ${masterList.tSeries.length} | Dubbed Series: ${masterList.dSeries.length}`);
  } catch (e) {
    console.error("Update failed:", e.message);
  }
}

// Run on startup and every 12 hours
updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

// ── Manifest ──────────────────────────────────────────────────────────────────
app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    id: "com.kanandhkumar.tamilott",
    version: "7.1.0",
    name: "Tamil Pro Max",
    description: "New Tamil movies, OTT dubbed hits, Tamil web series",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Tamil_language_logo.svg/200px-Tamil_language_logo.svg.png",
    resources: ["catalog"],
    types: ["movie", "series"],
    idPrefixes: ["tt", "tmdb:"],
    behaviorHints: { adult: false, p2p: false },
    catalogs: [
      { id: "pure_tamil_m", type: "movie",  name: "🎬 New Tamil Movies",       extra: [{ name: "skip", isRequired: false }] },
      { id: "dubbed_hits_m", type: "movie", name: "🌐 OTT Dubbed Hits",         extra: [{ name: "skip", isRequired: false }] },
      { id: "pure_tamil_s", type: "series", name: "📺 Tamil Web Series",        extra: [{ name: "skip", isRequired: false }] },
      { id: "dubbed_hits_s", type: "series",name: "🌐 Dubbed Series (OTT)",     extra: [{ name: "skip", isRequired: false }] },
    ],
    idPrefixes: ["tt", "tmdb:"],
  });
});

// ── Catalog route ─────────────────────────────────────────────────────────────
app.get("/catalog/:type/:id.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const skip = parseInt(req.query.skip || 0);
  const cid  = req.params.id;

  const listMap = {
    pure_tamil_m:  masterList.tMovies,
    dubbed_hits_m: masterList.dMovies,
    pure_tamil_s:  masterList.tSeries,
    dubbed_hits_s: masterList.dSeries,
  };

  const list = listMap[cid] || [];
  res.json({ metas: list.slice(skip, skip + 20) });
});

app.get("/health", (req, res) => res.json({
  status: "ok",
  counts: {
    tMovies:  masterList.tMovies.length,
    dMovies:  masterList.dMovies.length,
    tSeries:  masterList.tSeries.length,
    dSeries:  masterList.dSeries.length,
  }
}));

app.get("/", (req, res) => res.redirect("/manifest.json"));
app.listen(PORT, () => console.log(`🚀 Tamil Pro Max 7.1.0 on port ${PORT}`));
