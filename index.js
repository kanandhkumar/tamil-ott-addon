const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterTamilList = { allContent: [], series: [] };
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
    console.log(`🌞 Refreshing Master OTT Row (Newest First)...`);

    try {
        // 1. PURE TAMIL OTT RELEASES
        const tamilUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        
        // 2. TARGETED DUBBED OTT HITS (EN, HI, TE, ML, KN)
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en|hi|te|ml|kn&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        // 3. TAMIL WEB SERIES
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [rawT, rawD, rawS] = await Promise.all([
            fetchAllPages(tamilUrl, 3), fetchAllPages(dubbedUrl, 3), fetchAllPages(seriesUrl, 3)
        ]);

        // Combine Movies and Sort by Date
        const combinedMovies = [...rawT, ...rawD];
        const uniqueMovies = Array.from(new Map(combinedMovies.map(m => [m.id, m])).values())
            .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        // Process Master Movie Row (Top 100)
        const movieResults = [];
        for (const item of uniqueMovies.slice(0, 100)) {
            const p = await convertToPlayable(item, 'movie');
            if (p) movieResults.push(p);
            await delay(20);
        }
        masterTamilList.allContent = movieResults;

        // Process Series Row (Top 50)
        const seriesResults = [];
        for (const item of rawS.slice(0, 50)) {
            const p = await convertToPlayable(item, 'tv');
            if (p) seriesResults.push(p);
            await delay(20);
        }
        masterTamilList.series = seriesResults;

        console.log(`✅ Master Row Ready! Movies: ${masterTamilList.allContent.length}, Series: ${masterTamilList.series.length}`);
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
        id: "com.anandh.tamil.master",
        version: "6.9.0",
        name: "Tamil Master Row 2025",
        description: "Everything in one row: Latest Tamil & Dubbed OTT hits.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "master_movies", type: "movie", name: "Tamil & Dubbed OTT (2025+)" },
            { id: "tamil_series", type: "series", name: "Latest Tamil Web Series" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cid = req.params.id;
    let list = cid === "master_movies" ? masterTamilList.allContent : masterTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.9.0 Master Row Live"));
