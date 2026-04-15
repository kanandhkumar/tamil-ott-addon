const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { tMovies: [], dMovies: [], tSeries: [], dSeries: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

// Helper to fetch multiple pages from TMDB
async function fetchAllPages(url, pages = 3) {
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

// Helper to check if a movie/show has a Tamil translation on TMDB
async function hasTamilTranslation(id, type) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/translations?api_key=${TMDB_KEY}`);
        const data = await res.json();
        return data.translations.some(t => t.iso_639_1 === 'ta');
    } catch (e) { return false; }
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const langFilter = "en|hi|te|ml|kn";
    console.log(`🌞 Refreshing Smart Library: Validating Tamil Dubs...`);

    try {
        // 1. URLs - Using region=IN and release_type=4 (Digital) for better OTT accuracy
        const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&sort_by=primary_release_date.desc`;
        const dMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=${langFilter}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&sort_by=popularity.desc`;
        
        const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&sort_by=first_air_date.desc`;
        const dSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=${langFilter}&first_air_date.gte=${startDate}&sort_by=popularity.desc`;

        const [rawTM, rawDM, rawTS, rawDS] = await Promise.all([
            fetchAllPages(tMovieUrl, 2), fetchAllPages(dMovieUrl, 3), 
            fetchAllPages(tSeriesUrl, 2), fetchAllPages(dSeriesUrl, 3)
        ]);

        // 2. PROCESS PURE TAMIL MOVIES (50)
        masterList.tMovies = [];
        for (const item of rawTM.slice(0, 50)) {
            const p = await convertToPlayable(item, 'movie');
            if (p) masterList.tMovies.push(p);
            await delay(15);
        }

        // 3. PROCESS SMART DUBBED MOVIES (50)
        // We filter for "Popular in India" and check for Tamil Metadata
        const validDM = [];
        for (const item of rawDM) {
            if (validDM.length >= 50) break;
            const hasTa = await hasTamilTranslation(item.id, 'movie');
            if (hasTa) {
                const p = await convertToPlayable(item, 'movie');
                if (p) validDM.push(p);
            }
            await delay(15);
        }
        masterList.dMovies = validDM.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        // 4. PROCESS PURE TAMIL SERIES (50)
        masterList.tSeries = [];
        for (const item of rawTS.slice(0, 50)) {
            const p = await convertToPlayable(item, 'tv');
            if (p) masterList.tSeries.push(p);
            await delay(15);
        }

        // 5. PROCESS SMART DUBBED SERIES (50)
        const validDS = [];
        for (const item of rawDS) {
            if (validDS.length >= 50) break;
            const hasTa = await hasTamilTranslation(item.id, 'tv');
            if (hasTa) {
                const p = await convertToPlayable(item, 'tv');
                if (p) validDS.push(p);
            }
            await delay(15);
        }
        masterList.dSeries = validDS.sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        console.log(`✅ Update Successful! T-Movies: ${masterList.tMovies.length}, D-Movies: ${masterList.dMovies.length}`);
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
        id: "com.anandh.tamil.v7.smart",
        version: "7.1.0",
        name: "Tamil Pro Max (Smart Dub)",
        description: "Pure Tamil & Verified Dubbed Hits (EN/HI/TE/ML/KN)",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies (Pure)" },
            { id: "dubbed_hits_m", type: "movie", name: "New Dubbed Hits (Verified)" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series (Pure)" },
            { id: "dubbed_hits_s", type: "series", name: "New Dubbed Series" }
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

app.listen(PORT, () => console.log("🚀 v7.1.0 Smart Dubbing Live"));
