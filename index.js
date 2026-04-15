const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

// Central storage for your 6 custom rows
let masterList = { 
    tMovies: [], tSeries: [], // Pure Tamil
    dMovies: [], dSeries: [], // Dubbed Regional (Indian)
    eMovies: [], eSeries: []  // English Hits
};
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
    
    console.log(`🔄 Mega Sync: ${today} | Building 6 Specialized Rows...`);

    try {
        // 1. PURE TAMIL (Movies & Series)
        const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        
        // 2. INDIAN REGIONAL DUBBED (Hindi, Telugu, etc.)
        const indMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=${regionalLangs}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const indSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&with_original_language=${regionalLangs}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        // 3. ENGLISH HITS (Hollywood Series & Movies)
        const engMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const engSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        const [rawTM, rawTS, rawIndM, rawIndS, rawEngM, rawEngS] = await Promise.all([
            fetchAllPages(tMovieUrl), fetchAllPages(tSeriesUrl), 
            fetchAllPages(indMovieUrl, 3), fetchAllPages(indSeriesUrl, 3),
            fetchAllPages(engMovieUrl, 3), fetchAllPages(engSeriesUrl, 3)
        ]);

        // Process all categories with re-sorting for the "Newest First" view
        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');
        
        const indM = await processItems(rawIndM.slice(0, 50), 'movie');
        masterList.dMovies = indM.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        const indS = await processItems(rawIndS.slice(0, 50), 'tv');
        masterList.dSeries = indS.sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        const engM = await processItems(rawEngM.slice(0, 50), 'movie');
        masterList.eMovies = engM.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        const engS = await processItems(rawEngS.slice(0, 50), 'tv');
        masterList.eSeries = engS.sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        console.log(`✅ Success! All 6 Rows Synced for ${today}.`);
    } catch (e) { console.error("Sync failed", e); }
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
        id: "com.anandh.tamil.v7.mega",
        version: "7.3.0",
        name: "Tamil Pro Max 2025",
        description: "6 Custom Rows for Movies & Series (Tamil Dubbed)",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies (Pure)" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series (Pure)" },
            { id: "ind_dub_m", type: "movie", name: "New Indian Dubbed Movies" },
            { id: "ind_dub_s", type: "series", name: "New Indian Dubbed Series" },
            { id: "eng_dub_m", type: "movie", name: "English Hits (Tamil Dub)" },
            { id: "eng_dub_s", type: "series", name: "English Series (Tamil Dub)" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cid = req.params.id;
    let list = [];
    if (cid === "pure_tamil_m") list = masterList.tMovies;
    if (cid === "pure_tamil_s") list = masterList.tSeries;
    if (cid === "ind_dub_m") list = masterList.dMovies;
    if (cid === "ind_dub_s") list = masterList.dSeries;
    if (cid === "eng_dub_m") list = masterList.eMovies;
    if (cid === "eng_dub_s") list = masterList.eSeries;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v7.3.0 Mega Server Live"));
