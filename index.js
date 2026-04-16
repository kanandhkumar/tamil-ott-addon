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
const LANGUAGE_BUCKETS = ["ta", "te", "ml", "kn", "hi", "en"];

let masterList = {
  tamilAudioMovies: [],
  tamilAudioSeries: [],
  pureTamilMovies: [],
  pureTamilSeries: []
};

const delay = ms => new Promise(res => setTimeout(res, ms));

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
  let results = [];
  for (let p = 1; p <= pages; p++) {
    const data = await fetchJson(`${url}&page=${p}`);
    if (data && Array.isArray(data.results)) {
      results = results.concat(data.results);
    }
    await delay(120);
  }
  return results;
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

async function getImdbIdFromTmdb(itemId, type) {
  const endpointType = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/${endpointType}/${itemId}/external_ids?api_key=${TMDB_KEY}`;
  const data = await fetchJson(url);
  return data?.imdb_id || null;
}

function normalizeAudioCode(audio) {
  if (!audio) return "";
  if (typeof audio === "string") return audio.toLowerCase();
  if (typeof audio === "object") {
    return String(
      audio.language ||
      audio.iso_639_1 ||
      audio.code ||
      audio.name ||
      ""
    ).toLowerCase();
  }
  return "";
}

function hasTamilAudioInResponse(showData) {
  if (!showData) return false;

  const options = showData.streamingOptions;
  if (!options) return false;

  let indiaOptions = [];

  if (Array.isArray(options)) {
    indiaOptions = options;
  } else if (typeof options === "object") {
    indiaOptions = options[COUNTRY] || options[COUNTRY.toUpperCase()] || [];
  }

  if (!Array.isArray(indiaOptions) || indiaOptions.length === 0) return false;

  return indiaOptions.some(opt => {
    const audios = opt?.audios || [];
    if (!Array.isArray(audios)) return false;

    return audios.some(a => {
      const code = normalizeAudioCode(a);
      return code === "ta" || code === "tam" || code.includes("tamil");
    });
  });
}

async function getStreamingAvailabilityById(id) {
  if (!RAPIDAPI_KEY || !id) return null;

  const url = `https://${RAPIDAPI_HOST}/shows/${encodeURIComponent(id)}?country=${COUNTRY}&output_language=en`;
  return await fetchJson(url, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST
    }
  });
}

async function convertToPlayable(item, type) {
  const imdbId = await getImdbIdFromTmdb(item.id, type);
  if (!imdbId) return null;

  const date = type === "movie" ? item.release_date : item.first_air_date;

  return {
    id: imdbId,
    name: item.title || item.name || "",
    type: type === "movie" ? "movie" : "series",
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : undefined,
    background: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : undefined,
    release_date: date,
    first_air_date: date,
    description: `📅 ${date || "N/A"} | ⭐ ${item.vote_average || "N/A"}`
  };
}

async function processPlainItems(items, type, limit = 30) {
  const out = [];
  for (const item of items.slice(0, limit)) {
    const playable = await convertToPlayable(item, type);
    if (playable) out.push(playable);
    await delay(70);
  }
  return out;
}

async function processTamilAudioItems(items, type, limit = 40) {
  const out = [];

  for (const item of items) {
    if (out.length >= limit) break;

    try {
      const imdbId = await getImdbIdFromTmdb(item.id, type);
      if (!imdbId) {
        await delay(100);
        continue;
      }

      const streamData = await getStreamingAvailabilityById(imdbId);
      if (!hasTamilAudioInResponse(streamData)) {
        await delay(100);
        continue;
      }

      const date = type === "movie" ? item.release_date : item.first_air_date;

      out.push({
        id: imdbId,
        name: item.title || item.name || "",
        type: type === "movie" ? "movie" : "series",
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : undefined,
        background: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : undefined,
        release_date: date,
        first_air_date: date,
        description: `Tamil audio in IN | ${item.original_language?.toUpperCase() || "NA"} | 📅 ${date || "N/A"} | ⭐ ${item.vote_average || "N/A"}`
      });
    } catch (e) {
      console.error("Tamil audio process error:", e.message);
    }

    await delay(160);
  }

  return out;
}

async function fetchLanguageBuckets(type, languages, pages = 2) {
  const all = [];

  for (const lang of languages) {
    const endpoint = type === "movie" ? "movie" : "tv";
    const dateFieldGte = type === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    const dateFieldLte = type === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
    const sortField = type === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
    const regionPart = type === "movie" ? `&region=IN` : ``;

    const url =
      `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${TMDB_KEY}` +
      `&with_original_language=${lang}` +
      `${regionPart}` +
      `&${dateFieldGte}=${START_DATE}` +
      `&${dateFieldLte}=${new Date().toISOString().split("T")[0]}` +
      `&sort_by=${sortField}`;

    const results = await fetchAllPages(url, pages);
    all.push(...results);
  }

  return dedupeById(all);
}

async function updateDailyList() {
  console.log(`🔄 Sync started`);

  try {
    const pureTamilMovieUrl =
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}` +
      `&with_original_language=ta&region=IN` +
      `&primary_release_date.gte=${START_DATE}` +
      `&primary_release_date.lte=${new Date().toISOString().split("T")[0]}` +
      `&sort_by=primary_release_date.desc`;

    const pureTamilSeriesUrl =
      `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}` +
      `&with_original_language=ta` +
      `&first_air_date.gte=${START_DATE}` +
      `&first_air_date.lte=${new Date().toISOString().split("T")[0]}` +
      `&sort_by=first_air_date.desc`;

    const [rawTamilMovies, rawTamilSeries, rawMultiLangMovies, rawMultiLangSeries] = await Promise.all([
      fetchAllPages(pureTamilMovieUrl, 2),
      fetchAllPages(pureTamilSeriesUrl, 2),
      fetchLanguageBuckets("movie", LANGUAGE_BUCKETS, 2),
      fetchLanguageBuckets("tv", LANGUAGE_BUCKETS, 2)
    ]);

    masterList.pureTamilMovies = (await processPlainItems(rawTamilMovies, "movie", 30))
      .sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));

    masterList.pureTamilSeries = (await processPlainItems(rawTamilSeries, "tv", 30))
      .sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));

    masterList.tamilAudioMovies = await processTamilAudioItems(rawMultiLangMovies, "movie", 40);
    masterList.tamilAudioSeries = await processTamilAudioItems(rawMultiLangSeries, "tv", 40);

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
    version: "8.1.0",
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
