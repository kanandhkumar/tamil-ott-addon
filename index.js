const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { tMovies: [], dMovies: [], tSeries: [], dSeries: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchAllPages(url, pages = 2) {
    let results = [];
    for (let p = 1; p <= pages; p++) {
        try {
            const res = await fetch(`${url}&page=${p}`);
            const data = await res.json();
            if (data.results) results = results.concat(data.results);
        } catch (e) { console.error("Fetch error", e); }
    }
    return results;
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const regionalLangs = "hi|te|ml|kn";
    
    console.log(`🔄 Daily Sync: ${today} | Balancing English vs Indian Series...`);

    try {
        // 1. PURE TAMIL (Movies & Series)
        const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        
        // 2. DUBBED MOVIES (Indian OTT releases)
        const dMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en|${regionalLangs}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        // 3. DUBBED SERIES DUAL-SCAN (To stop English from taking over)
        // Scan A: Popular Indian Shows (Hindi, Telugu, etc.)
        const indSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&with_original_language=${regionalLangs}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;
        // Scan B: Popular Hollywood Hits
        const engSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        const [rawTM, rawDM, rawTS, rawIndS, rawEngS] = await Promise.all([
            fetchAllPages(tMovieUrl, 2), fetchAllPages(dMovieUrl, 3), 
            fetchAllPages(tSeriesUrl, 2), fetchAllPages(indSeriesUrl, 2), fetchAllPages(engSeriesUrl, 2)
        ]);

        // Process Pure Tamil
        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');

        // Process Dubbed Movies
        const dubbedMovies = await processItems(rawDM.slice(0, 60), 'movie');
        masterList.dMovies = dubbedMovies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        // Process Dubbed Series (Merging Indian hits and English hits 50/50)
        const combinedSeries = [...rawIndS.slice(0, 30), ...rawEngS.slice(0, 30)];
        const processedSeries = await processItems(combinedSeries, 'tv');
        
        // Final Sort: Newest Release Date First
        masterList.dSeries = processedSeries.sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        console.log(`✅ Update Successful! Re-balanced Indian & Global rows.`);
    } catch (e) { console.error("Daily update failed", e); }
}

async function processItems(items, type) {
    const list = [];
    for (const item of items) {
        const p = await convertToPlayable(item, type);
        if (p) list.push(p);
        await delay(20);
    }
    return list;
}

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

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.v7.balanced",
        version: "7.2.7",
        name: "Tamil Pro Max 2025",
        description: "Indian & Hollywood Hits (Tamil Dubbed Only)",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies (Pure)" },
            { id: "dubbed_hits_m", type: "movie", name: "New Dubbed Hits (Global)" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series (Pure)" },
            { id: "dubbed_hits_s", type: "series", name: "New Dubbed Series (Ind+Eng)" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

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

app.listen(PORT, () => console.log("🚀 v7.2.7 Balanced Server Live"));
