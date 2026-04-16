const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const PORT = process.env.PORT || 10000;

const RAPIDAPI_HOST = "streaming-availability.p.rapidapi.com";
const COUNTRY = "in";
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

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
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

function normalizeAudio(audio) {
  if (!audio) return "";
  if (typeof audio === "string") return audio.toLowerCase();
  return String(audio.language || audio.iso_639_1 || audio.code || audio.name || "").toLowerCase();
}

function hasTamilAudio(show) {
  if (!show || !show.streamingOptions) return false;
  const opts = Array.isArray(show.streamingOptions)
    ? show.streamingOptions
    : (show.streamingOptions[COUNTRY] || show.streamingOptions[COUNTRY.toUpperCase()] || []);
  if (!Array.isArray(opts)) return false;

  return opts.some(opt =>
    Array.isArray(opt.audios) &&
    opt.audios.some(a => {
      const code = normalizeAudio(a);
      return code === "ta" || code === "tam" || code.includes("tamil");
    })
  );
}

function itemYear(item, type) {
  const d = type === "movie" ? item.release_date : item.first_air_date;
  return d ? d.slice(0, 4) : "";
}

function sameTitle(tmdbItem, candidate, type) {
  const a = (tmdbItem.title || tmdbItem.name || "").trim().toLowerCase();
  const b = (candidate.title || candidate.showTitle || candidate.originalTitle || "").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const y1 = itemYear(tmdbItem, type);
  const y2 = String(candidate.releaseYear || candidate.year || "");
  return !!(y1 && y2 && y1 === y2 && a.split(" ")[0] === b.split(" ")[0]);
}

async function searchByTitle(item, type) {
  const title = item.title || item.name;
  if (!title || !RAPIDAPI_KEY) return null;

  const showType = type === "movie" ? "movie" : "series";
  const url =
    `https://${RAPIDAPI_HOST}/shows/search/title` +
    `?title=${encodeURIComponent(title)}` +
    `&country=${COUNTRY}` +
    `&show_type=${showType}` +
    `&output_language=en`;

  const data = await fetchJson(url, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST
    }
  });

  const results = Array.isArray(data) ? data : (Array.isArray(data?.result) ? data.result : []);
  if (!results.length) return null;

  return results.find(r => sameTitle(item, r, type)) || results[0];
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

async function processPlain(items, type, limit = 30) {
  const out = [];
  for (const item of items.slice(0, limit)) {
    const meta = await toMeta(item, type);
    if (meta) out.push(meta);
    await wait(60);
  }
  return out;
}

async function processTamilAudio(items, type, limit = 40) {
  const out = [];
  for (const item of items) {
    if (out.length >= limit) break;

    const imdbId = await getImdbId(item.id, type);
    if (!imdbId) {
      await wait(100);
      continue;
    }

    const show = await searchByTitle(item, type);
    if (!show || !hasTamilAudio(show)) {
      await wait(100);
      continue;
    }

    const date = type === "movie" ? item.release_date : item.first_air_date;

    out.push({
      id: imdbId,
      type: type === "movie" ? "movie" : "series",
      name: item.title || item.name || "",
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
      description: `Tamil audio in IN | ${item.original_language?.toUpperCase() || "NA"} | 📅 ${date || "N/A"} | ⭐ ${item.vote_average || "N/A"}`,
      release_date: date,
      first_air_date: date
    });

    await wait(140);
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

    masterList.pureTamilMovies = await processPlain(rawTamilMovies, "movie", 30);
    masterList.pureTamilSeries = await processPlain(rawTamilSeries, "tv", 30);
    masterList.tamilAudioMovies = await processTamilAudio(rawMultiMovies, "movie", 40);
    masterList.tamilAudioSeries = await processTamilAudio(rawMultiSeries, "tv", 40);

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
    version: "8.2.1",
    name: "Tamil OTT Audio",
    description: "Pure Tamil plus Indian and English titles with Tamil audio in India",
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
