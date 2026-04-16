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

function getIndiaStreamingOptions(showData) {
  if (!showData || !showData.streamingOptions) return [];

  const options = showData.streamingOptions;

  if (Array.isArray(options)) return options;
  if (typeof options === "object") {
    return options[COUNTRY] || options[COUNTRY.toUpperCase()] || [];
  }

  return [];
}

function hasTamilAudioInResponse(showData) {
  const indiaOptions = getIndiaStreamingOptions(showData);
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

function getYearFromItem(item, type) {
  const raw = type === "movie" ? item.release_date : item.first_air_date;
  if (!raw || typeof raw !== "string") return null;
  return raw.slice(0, 4);
}

function titleMatches(tmdbItem, candidate, type) {
  const tmdbTitle = (tmdbItem.title || tmdbItem.name || "").trim().toLowerCase();
  const apiTitle = (candidate.title || candidate.showTitle || candidate.originalTitle || "").trim().toLowerCase();

  if (!tmdbTitle || !apiTitle) return false;
  if (tmdbTitle === apiTitle) return true;
  if (apiTitle.includes(tmdbTitle) || tmdbTitle.includes(apiTitle)) return true;

  const tmdbYear = getYearFromItem(tmdbItem, type);
  const apiYear = String(candidate.releaseYear || candidate.year || "").trim();

  if (tmdbYear && apiYear && tmdbYear === apiYear) {
    const firstWordA = tmdbTitle.split(" ")[0];
    const firstWordB = apiTitle.split(" ")[0];
    if (firstWordA && firstWordA === firstWordB) return true;
  }

  return false;
}

async function searchStreamingAvailabilityByTitle(item, type) {
  if (!RAPIDAPI_KEY) return null;

  const title = item.title || item.name;
  if (!title) return null;

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

  if (!data) return null;

  const results = Array.isArray(data) ? data : (Array.isArray(data.result) ? data.result : []);
  if (!results.length) return null;

  const exact = results.find(candidate => titleMatches(item, candidate, type));
  return exact || results[0] || null;
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

      const streamData = await searchStreamingAvailabilityByTitle(item, type);
      if (!streamData) {
        await delay(120);
        continue;
      }

      if (!hasTamilAudioInResponse(streamData)) {
        await delay(120);
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
        description: `Tamil audio in IN | ${item.original_language?.toUpperCase() || "NA"} | 
