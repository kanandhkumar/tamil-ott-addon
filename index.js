const express = require("express");
const fetch = require("node-fetch");
const pLimit = require("p-limit"); 

const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;
const PORT = process.env.PORT || 10000;

// --- CONFIG ---
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_ITEMS = 1000;
const MAX_CONCURRENCY = 10; 
const FETCH_TIMEOUT = 7000;

const cache = new Map();

// --- CACHE HELPERS ---
function setCache(key, value) {
  if (cache.size > CACHE_MAX_ITEMS) cache.clear();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiresAt) return null;
  return item.value;
}

// --- NETWORK HELPER ---
async function fetchJson(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`[Network Error] ${label}:`, e.message);
    return null;
  }
}

// --- 1. WATCHMODE: AVAILABILITY CHECKER (FUTURE-PROOF) ---
async function checkStreamingStatus(imdbId, targetSourceId) {
  const cacheKey = `avail:${imdbId}:${targetSourceId}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;

  // Using the per-title sources endpoint for maximum accuracy and stability
  const url = `https://api.watchmode.com/v1/title/${imdbId}/sources/?apiKey=${WATCHMODE_KEY}&regions=IN`;
  const data = await fetchJson(url, `Watchmode Avail ${imdbId}`);
  
  if (!data || !Array.isArray(data)) return false;

  // Verify if the requested platform is listed as a source
  const isOnPlatform = data.some(s => s.source_id === targetSourceId);
  
  setCache(cacheKey, isOnPlatform);
  return isOnPlatform;
}

// --- 2. TMDB: DISCOVERY & METADATA ---
async function getTrendingTamil(type) {
  const cacheKey = `trending:${type}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const tmdbType = type === "movie" ? "movie" : "tv";
  // Fetching trending Tamil content directly via TMDB
  const url = `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_KEY}&with_original_language=ta&sort_by=popularity.desc&region=IN&page=1`;

  const data = await fetchJson(url, "TMDB Discovery");
  if (!data || !data.results) return [];

  const limit = pLimit(MAX_CONCURRENCY);
  const metas = await Promise.all(
    data.results.slice(0, 40).map(item =>
      limit(async () => {
        const idsUrl = `https://api.themoviedb.org/3/${tmdbType}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const idsData = await fetchJson(idsUrl, "External IDs");
        
        if (!idsData || !idsData.imdb_id) return null;

        return {
          id: idsData.imdb_id,
          type,
          name:
