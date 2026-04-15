const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { tamilMovies: [], dubbedHits: [], series: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchAllPages(baseUrl, pages = 3) {
    let results = [];
    for (let p = 1; p <= pages; p++) {
        try {
            const res = await fetch(`${baseUrl}&page=${p}`);
            const data = await res.json();
            if (data.results) results = results.concat(data.results);
        } catch (e) { console.error("Page fetch error", e); }
    }
    return results;
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    console.log(`🌞 Refreshing Custom Dubbed Row (EN, HI, TE, ML, KN)...`);

    try {
        // 1. PURE TAMIL MOVIES
        const tamilUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&region=IN`;
        
        // 2. TARGETED DUBBED HITS (English, Hindi, Telugu, Malayalam, Kannada)
        // 'en|hi|te|ml|kn' covers the languages you requested
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en|hi|te|ml|kn&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        // 3. TAMIL SERIES
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [rawT, rawD, rawS] = await Promise.all([
            fetchAllPages(tamilUrl), fetchAllPages(dubbedUrl), fetchAllPages(seriesUrl)
        ]);

        // Process Tamil Movies (50)
        dailyTamilList.tamilMovies = [];
        for (const item of rawT.slice(0, 50)) {
            const p = await convertToPlayable(item, 'movie');
            if (p) dailyTamilList.tamilMovies.push(p);
            await delay(20);
        }

        // Process Dubbed Hits (50) - Sorted by Newest from the popular pool
        const sortedDubbed = rawD.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
        dailyTamilList.dubbedHits = [];
        for (const item of sortedDubbed.slice(0, 50)) {
            const p = await convertToPlayable(item, 'movie');
            if (p) dailyTamilList.dubbedHits.push(p);
            await delay(20);
        }

        // Process Series (50)
        dailyTamilList.series = [];
        for (const item of rawS.slice(0, 50)) {
            const p = await convertToPlayable(item, 'tv');
            if (p) dailyTamilList.series.push(p);
            await delay(20);
        }

        console.log(`✅ Update Successful! Tamil: ${dailyTamilList.tamilMovies.length}, Dubbed: ${dailyTamilList.dubbedHits.length}, Series: ${dailyTamilList.series.length}`);
    } catch (e) { console.error("Update failed", e); }
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
        id: "com.anandh.tamil.v8",
        version: "6.8.0",
        name: "Tamil Pro 2025",
        description: "50 Tamil, 50 Dubbed (EN/HI/TE/ML/KN), 50 Series.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "pure_tamil", type: "movie", name: "New Tamil Movies (Pure)" },
            { id: "dubbed_hits", type: "movie", name: "New Dubbed & Global Hits" },
            { id: "tamil_series", type: "series", name: "New Tamil Series" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cid = req.params.id;
    let list = [];
    if (cid === "pure_tamil") list = dailyTamilList.tamilMovies;
    if (cid === "dubbed_hits") list = dailyTamilList.dubbedHits;
    if (cid === "tamil_series") list = dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.8.0 Live"));
