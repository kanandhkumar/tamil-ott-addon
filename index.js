const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const WATCHMODE_KEY = process.env.WATCHMODE_KEY;

console.log("WATCHMODE_KEY exists:", !!WATCHMODE_KEY);
console.log("TMDB_KEY exists:", !!TMDB_KEY);

const manifest = {
  id: "com.kanandhkumar.tamilott",
  version: "4.2.1",
  name: "Tamil OTT Catalog",
  description: "Tamil movie catalogs for Netflix, Prime Video, SunNXT, ZEE5, SonyLIV and JioHotstar.",
  logo: "https://www.stremio.com/website/stremio-logo-small.png",
  resources: ["catalog"],
  types: ["movie"],
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
    const url = `https://api.watchmode.com/v1/list-titles/?apiKey=${WATCHMODE_KEY}&source_ids=${sourceId}&types=${wmType}&regions
