Const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { 
    cinema: [],
    tMovies: [], tSeries: [], 
    dMovies: [], dSeries: [], 
    eMovies: [], eSeries: []
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

// Helper function to fetch and combine multiple languages concurrently
async function fetchMultiLang(baseUrl, langs, pages = 2) {
    const promises = langs.map(lang => fetchAllPages(`${baseUrl}&with_original_language=${lang}`, pages));
    const resultsArrays = await Promise.all(promises);
    const combined = resultsArrays.flat();
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const regionalLangs = ["hi", "te", "ml", "kn"];
    const cinemaLangs = ["ta", "hi", "te", "ml", "kn"];

    console.log(`🔄 Sync Started: ${today}`);

    try {
        const tMovieBase   = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesBase  = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        const indMovieBase = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}`;
        const indSeriesBase= `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&first_air_date.gte=${startDate}&first_air_date.lte=${today}`;
        const engMovieBase = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const engSeriesBase= `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;
        const cinemaBase   = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&with_release_type=3&primary_release_date.gte=${sixtyDaysAgo}&primary_release_date.lte=${today}`;

        const rawTM = await fetchAllPages(`${tMovieBase}&with_original_language=ta`, 2);
        const rawTS = await fetchAllPages(`${tSeriesBase}&with_original_language=ta`, 2);
        const rawEngM = await fetchAllPages(`${engMovieBase}&with_original_language=en`, 3);
        const rawEngS = await fetchAllPages(`${engSeriesBase}&with_original_language=en`, 3);

        const rawIndM = await fetchMultiLang(indMovieBase, regionalLangs, 2);
        const rawIndS = await fetchMultiLang(indSeriesBase, regionalLangs, 2);
        const rawCinema = await fetchMultiLang(cinemaBase, cinemaLangs, 2);

        rawIndM.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
        rawIndS.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
        
        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');
        masterList.dMovies = await processItems(rawIndM.slice(0, 50), 'movie');
        masterList.dSeries = await processItems(rawIndS.slice(0, 50), 'tv');
        masterList.eMovies = await processItems(rawEngM.slice(0, 50), 'movie');
        masterList.eSeries = await processItems(rawEngS.slice(0, 50), 'tv');

        const cinemaItems = rawCinema
            .filter(m => m.poster_path)
            .sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
        
        masterList.cinema = await processItems(cinemaItems.slice(0, 40), 'movie', true);

        console.log(`✅ Done! Cinema: ${masterList.cinema.length}, Tamil: ${masterList.tMovies.length}`);
    } catch (e) { console.error("Sync failed", e); }
}

async function processItems(items, type, isCinema = false) {
    const list = [];
    for (const item of items) {
        const p = await convertToPlayable(item, type, isCinema);
        if (p) list.push(p);
        await delay(20);
    }
    return list;
}

async function convertToPlayable(item, type, isCinema = false) {
    try {
        const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const res = await fetch(idUrl);
        const ids = await res.json();
        const date = type === 'movie' ? item.release_date : item.first_air_date;
        const year = date ? date.slice(0, 4) : '';
        const baseName = item.title || item.name;

        // 🖼️ NEW POSTER SELECTION: Use custom CDN if IMDb ID exists, fallback to standard TMDB path
        let posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
        if (ids.imdb_id) {
            posterUrl = `https://btttr.cc/poster-q/imdb/poster-default/${ids.imdb_id}.jpg`;
        }

        const metaObj = {
            id:          ids.imdb_id || `tmdb:${item.id}`,
            name:        isCinema ? `${baseName} 🎬 [IN CINEMA]` : baseName,
            type:        type === 'movie' ? 'movie' : 'series',
            poster:      posterUrl,
            releaseInfo: year,
            released:    date ? new Date(date).toISOString() : undefined,
            imdbRating:  item.vote_average && item.vote_average > 0 ? item.vote_average.toFixed(1) : undefined,
            description: item.overview || `📅 Release Date: ${date || 'N/A'}`,
        };

        if (isCinema) {
            metaObj.inTheaters = true; 
        }

        return metaObj;
    } catch (e) { return null; }
}

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "max-age=0, no-cache, no-store, must-revalidate");
    res.json({
        id: "com.anandh.tamil.v8.cinema", 
        version: "8.1.0", // Version bumped to 8.1.0
        name: "Tamil Pro Max 2025 (v8)", 
        description: "7 Rows - Cinema, Tamil, Dubbed & Hollywood",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tamil_cinema",  type: "movie",  name: "🎬 Now In Cinemas",           extra: [{ name: "skip", isRequired: false }] },
            { id: "pure_tamil_m",  type: "movie",  name: "New Tamil Movies (Pure)",      extra: [{ name: "skip", isRequired: false }] },
            { id: "pure_tamil_s",  type: "series", name: "New Tamil Series (Pure)",      extra: [{ name: "skip", isRequired: false }] },
            { id: "ind_dub_m",     type: "movie",  name: "New Indian Dubbed Movies",     extra: [{ name: "skip", isRequired: false }] },
            { id: "ind_dub_s",     type: "series", name: "New Indian Dubbed Series",     extra: [{ name: "skip", isRequired: false }] },
            { id: "eng_dub_m",     type: "movie",  name: "Hollywood Hits (Tamil Dub)",   extra: [{ name: "skip", isRequired: false }] },
            { id: "eng_dub_s",     type: "series", name: "Hollywood Series (Tamil Dub)", extra: [{ name: "skip", isRequired: false }] },
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "max-age=0, no-cache, no-store, must-revalidate");
    
    const cid  = req.params.id;
    const skip = parseInt(req.query.skip || 0);
    let list = [];
    
    if (cid === "tamil_cinema")  list = masterList.cinema;
    if (cid === "pure_tamil_m")  list = masterList.tMovies;
    if (cid === "pure_tamil_s")  list = masterList.tSeries;
    if (cid === "ind_dub_m")     list = masterList.dMovies;
    if (cid === "ind_dub_s")     list = masterList.dSeries;
    if (cid === "eng_dub_m")     list = masterList.eMovies;
    if (cid === "eng_dub_s")     list = masterList.eSeries;
    
    res.json({ metas: (list || []).slice(skip, skip + 20) });
});

app.get("/health", (req, res) => res.json({
    status: "ok", version: "8.1.0",
    cinema:  masterList.cinema.length,
    tMovies: masterList.tMovies.length,
    tSeries: masterList.tSeries.length,
}));

app.listen(PORT, () => console.log("🚀 Tamil Pro Max 8.1.0 Live"));
