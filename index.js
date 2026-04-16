const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;
const START_DATE = "2025-01-01";
const REFRESH_MS = 12 * 60 * 60 * 1000;
const LANGS = ["ta", "te", "ml", "kn", "hi", "en"];

let masterList = {
  pureTamilMovies: [],
  pureTamilSeries: [],
  tamilAudioMovies: [],
  tamilAudioSeries: []
};

const wait = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`HTTP ${res.status} -> ${url}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("Fetch error:", e.message);
    return null;
  }
}

async function fetchAllPages(url, pages = 2) {
  let out = [];
  for (let p = 1; p <= pages; p++) {
    const data = await fetchJson(`${url}&page=${p}`);
    if (data && Array.isArray(data.results)) out = out.concat(data.results);
    await wait(120);
  }
  return out;
}

function uniqById(items) {
  const seen = new Map();
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

async function getImdbId(tmdbId, type) {
  const endpoint = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`;
  const data = await fetchJson(url);
  return data?.imdb_id || null;
}

async function toMeta(item, type) {
  const imdbId = await getImdbId(item.id, type);
  if (!imdbId) return null;

  const date = type === "movie" ? item.release_date : item.first_air_date;

  return {
    id: imdbId,
    type: type === "movie" ? "movie" : "series",
    name: item.title || item.name || "",
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
    background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
    description: `📅 ${date || "N/A"} | ⭐ ${item.vote_average || "N/A"}`,
    release_date: date,
    first_air_date: date
  };
}

async function processItems(items, type, limit = 30) {
  const out = [];
  for (const item of items.slice(0, limit)) {
    const meta = await toMeta(item, type);
    if (meta) out.push(meta);
    await wait(60);
  }
  return out;
}

async function fetchBuckets(type, langs, pages = 2) {
  const today = new Date().toISOString().split("T")[0];
  let all = [];

  for (const lang of langs) {
    const endpoint = type === "movie" ? "movie" : "tv";
    const gte = type === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    const lte = type === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
    const sort = type === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
    const region = type === "movie" ? "&region=IN" : "";

    const url =
      `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${TMDB_KEY}` +
      `&with_original_language=${lang}` +
      `${region}` +
      `&${gte}=${START_DATE}` +
      `&${lte}=${today}` +
      `&sort_by=${sort}`;

    const results = await fetchAllPages(url, pages);
    all = all.concat(results);
  }

  return uniqById(all);
}

async function updateDailyList() {
  console.log("🔄 Sync started");
  try {
    const today = new Date().toISOString().split("T")[0];

    const pureTamilMovieUrl =
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}` +
      `&with_original_language=ta&region=IN` +
      `&primary_release_date.gte=${START_DATE}` +
      `&primary_release_date.lte=${today}` +
      `&sort_by=primary_release_date.desc`;

    const pureTamilSeriesUrl =
      `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}` +
      `&with_original_language=ta` +
      `&first_air_date.gte=${START_DATE}` +
      `&first_air_date.lte=${today}` +
      `&sort_by=first_air_date.desc`;

    const [rawTamilMovies, rawTamilSeries, rawMultiMovies, rawMultiSeries] = await Promise.all([
      fetchAllPages(pureTamilMovieUrl, 2),
      fetchAllPages(pureTamilSeriesUrl, 2),
      fetchBuckets("movie", LANGS, 2),
      fetchBuckets("tv", LANGS, 2)
    ]);

    masterList.pureTamilMovies = await processItems(rawTamilMovies, "movie", 30);
    masterList.pureTamilSeries = await processItems(rawTamilSeries, "tv", 30);
    masterList.tamilAudioMovies = await processItems(rawMultiMovies, "movie", 40);
    masterList.tamilAudioSeries = await processItems(rawMultiSeries, "tv", 40);

    console.log(
      `✅ Done | pureTamilMovies=${masterList.pureTamilMovies.length} ` +
      `pureTamilSeries=${masterList.pureTamilSeries.length} ` +
      `tamilAudioMovies=${masterList.tamilAudioMovies.length} ` +
      `tamilAudioSeries=${masterList.tamilAudioSeries.length}`
    );
  } catch (e) {
    console.error("Sync failed:", e.message);
  }
}

updateDailyList();
setInterval(updateDailyList, REFRESH_MS);

app.get("/", (req, res) => {
  res.send("Tamil OTT Audio addon running");
});

app.get("/manifest.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    id: "com.anandh.tamil.audio",
    version: "9.0.0",
    name: "Tamil OTT Audio",
    description: "Pure Tamil plus multilingual titles",
    resources: ["catalog"],
    types: ["movie", "series"],
    catalogs: [
      { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies (Pure)" },
      { id: "pure_tamil_s", type: "series", name: "New Tamil Series (Pure)" },
      { id: "tamil_audio_m", type: "movie", name: "Tamil Audio Movies" },
      { id: "tamil_audio_s", type: "series", name: "Tamil Audio Series" }
    ],
    idPrefixes: ["tt"]
  });
});

app.get("/catalog/:type/:id.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const cid = req.params.id;
  let list = [];

  if (cid === "pure_tamil_m") list = masterList.pureTamilMovies;
  if (cid === "pure_tamil_s") list = masterList.pureTamilSeries;
  if (cid === "tamil_audio_m") list = masterList.tamilAudioMovies;
  if (cid === "tamil_audio_s") list = masterList.tamilAudioSeries;

  res.json({ metas: list || [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Tamil OTT Audio running on port ${PORT}`);
});
