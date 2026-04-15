const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

// Central storage for your 4 custom rows
let masterList = { tMovies: [], dMovies: [], tSeries: [], dSeries: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Fetches multiple pages from TMDB to ensure rows are well-populated
 */
async function fetchAllPages(url, pages = 3) {
    let results = [];
    for (let p = 1; p <= pages; p++) {
        try {
            const res = await fetch(`${url}&page=${p}`);
            const data = await res.json();
            if (data.results) results = results.concat(data.results);
        } catch (e) { console.error("Fetch error on page " + p, e); }
    }
    return results;
}

/**
 * Main update logic: Re-calculates 'today' each time it runs for auto-updates.
 */
async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const langFilter = "hi|te|ml|kn|en"; // For dubbed rows
    
    console.log(`🔄 Daily Sync: ${today} | Filtering for Released Indian Content...`);

    try {
        // 1. URLs - Using .lte=${today} to block future/unreleased titles
        // Pure Tamil
        const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        
        // Dubbed Hits (Targeting Indian Origin for better Series results)
        const dMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=${langFilter}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const dSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&with_original_language=${langFilter}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        const [rawTM, rawDM, rawTS, rawDS] = await Promise.all([
            fetchAllPages(tMovieUrl, 2), 
            fetchAllPages(dMovieUrl, 3), 
            fetchAllPages(tSeriesUrl, 2), 
            fetchAllPages(dSeriesUrl, 3)
        ]);

        // Process all categories with a small delay to respect TMDB rate limits
        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        
        const dubbedMovies = await processItems(rawDM.slice(0, 60), 'movie');
        masterList.dMovies = dubbedMovies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');

        const dubbedSeries = await processItems(rawDS.slice(0, 60), 'tv');
        masterList.dSeries = dubbedSeries.sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        console.log(`✅ Update Successful! Found ${masterList.dSeries.length} Indian Dubbed Series.`);
    } catch (e) { 
        console.error("Daily update failed", e); 
    }
}

/**
 * Helper to process items into playable Stremio metadata
 */
async function processItems(items, type) {
    const list = [];
    for (const item of items) {
        const p = await convertToPlayable(item, type);
        if (p) list.push(p);
        await delay(20);
    }
    return list;
}

/**
 * Converts TMDB raw data into Stremio-compatible metadata with IMDb IDs
 */
async function convertToPlayable(item, type) {
    try {
        const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const res = await fetch(idUrl);
        const ids = await res.json();
        return {
            id: ids.imdb_id || `tmdb:${item.id}`,
            name: item.title || item.name,
            type: type === 'movie' ? 'movie' : 'series',
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            description: `📅 ${item.release_date || item.first_air_date} | ⭐ ${item.vote_average || 'N/A'}`
        };
    } catch (e) { return null; }
}

// Initial Run on start
updateDailyList();

// Set up the 12-hour heartbeat for daily updates
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

// STREMIO MANIFEST
app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.v7.auto",
        version: "7.2.5",
        name: "Tamil Pro Max 2025",
        description: "Strictly Released Indian Tamil & Dubbed Content",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies (Pure)" },
            { id: "dubbed_hits_m", type: "movie", name: "New Dubbed Hits (Global)" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series (Pure)" },
            { id: "dubbed_hits_s", type: "series", name: "New Indian Dubbed Series" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

// CATALOG ENDPOINT
app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cid = req.params.id;
    let list = [];
    if (cid === "pure_tamil_m") list = masterList.tMovies;
    if (cid === "dubbed_hits_m") list = masterList.dMovies;
    if (cid === "pure_tamil_s") list = masterList.tSeries;
    if (cid === "dubbed_hits_s") list = masterList.dSeries;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v7.2.5 Automated Server Live"));
