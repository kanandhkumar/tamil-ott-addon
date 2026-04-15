const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { tamilMovies: [], dubbedHits: [], series: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    console.log(`🌞 Refreshing 50/50 Library...`);

    try {
        // 1. PURE TAMIL MOVIES
        const tamilUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&region=IN`;
        
        // 2. DUBBED/TRENDING HITS (Hollywood/Other languages in India)
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&certification_country=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;

        // 3. TAMIL SERIES
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [resT, resD, resS] = await Promise.all([fetch(tamilUrl), fetch(dubbedUrl), fetch(seriesUrl)]);
        const dataT = await resT.json();
        const dataD = await resD.json();
        const dataS = await resS.json();

        // Process 50 Pure Tamil Movies
        dailyTamilList.tamilMovies = [];
        for (const item of (dataT.results || []).slice(0, 50)) {
            const playable = await convertToPlayable(item, 'movie');
            if (playable) dailyTamilList.tamilMovies.push(playable);
            await delay(30);
        }

        // Process 50 Dubbed/Global Hits
        dailyTamilList.dubbedHits = [];
        for (const item of (dataD.results || []).slice(0, 50)) {
            const playable = await convertToPlayable(item, 'movie');
            if (playable) dailyTamilList.dubbedHits.push(playable);
            await delay(30);
        }

        // Process 50 Series
        dailyTamilList.series = [];
        for (const item of (dataS.results || []).slice(0, 50)) {
            const playable = await convertToPlayable(item, 'tv');
            if (playable) dailyTamilList.series.push(playable);
            await delay(30);
        }

        console.log(`✅ Update Successful! Tamil: ${dailyTamilList.tamilMovies.length}, Dubbed: ${dailyTamilList.dubbedHits.length}, Series: ${dailyTamilList.series.length}`);
    } catch (e) {
        console.error("❌ Update failed:", e.message);
    }
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
        id: "com.anandh.tamil.50.50",
        version: "6.6.0",
        name: "Tamil Pro 2025 (50/50)",
        description: "Strictly sorted: Newest 50 Tamil and 50 Dubbed hits.",
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
    const catalogId = req.params.id;
    let list = [];
    if (catalogId === "pure_tamil") list = dailyTamilList.tamilMovies;
    if (catalogId === "dubbed_hits") list = dailyTamilList.dubbedHits;
    if (catalogId === "tamil_series") list = dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.6.0 50/50 Live"));
