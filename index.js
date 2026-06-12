const express = require("express");
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

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const regionalLangs = "hi|te|ml|kn";

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`🔄 Sync Started: ${today}`);

    try {
        const tMovieUrl    = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesUrl   = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        const indMovieUrl  = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=${regionalLangs}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const indSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&with_original_language=${regionalLangs}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;
        const engMovieUrl  = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const engSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;
        const cinemaUrl    = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta|hi|te|ml|kn&region=IN&with_release_type=3&primary_release_date.gte=${sixtyDaysAgo}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        const [rawTM, rawTS, rawIndM, rawIndS, rawEngM, rawEngS, rawCinema] = await Promise.all([
            fetchAllPages(tMovieUrl),
            fetchAllPages(tSeriesUrl),
            fetchAllPages(indMovieUrl, 3),
            fetchAllPages(indSeriesUrl, 3),
            fetchAllPages(engMovieUrl, 3),
            fetchAllPages(engSeriesUrl, 3),
            fetchAllPages(cinemaUrl, 2),
        ]);

        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');
        masterList.dMovies = await processItems(rawIndM.slice(0, 50), 'movie');
        masterList.dSeries = await processItems(rawIndS.slice(0, 50), 'tv');
        masterList.eMovies = await processItems(rawEngM.slice(0, 50), 'movie');
        masterList.eSeries = await processItems(rawEngS.slice(0, 50), 'tv');

        const cinemaItems = rawCinema
            .filter(m => m.poster_path)
            .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
        
        // Pass true for the isCinema flag specifically for the cinema row
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

        // Build the base meta object
        const metaObj = {
            id:          ids.imdb_id || `tmdb:${item.id}`,
            name:        item.title || item.name,
            type:        type === 'movie' ? 'movie' : 'series',
            poster:      item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            releaseInfo: year, // Keep releaseInfo clean as the banner will handle the "In Cinema" text visually
            imdbRating:  item.vote_average && item.vote_average > 0 ? item.vote_average.toFixed(1) : undefined,
            description: item.overview || `📅 Release Date: ${date || 'N/A'}`,
        };

        // 🎬 If this item belongs to the cinema catalog, append the inTheaters flag
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
    res.json({
        id: "com.anandh.tamil.v7.pop",
        version: "7.4.1",
        name: "Tamil Pro Max 2025",
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
    status: "ok", version: "7.4.1",
    cinema:  masterList.cinema.length,
    tMovies: masterList.tMovies.length,
    tSeries: masterList.tSeries.length,
}));

app.listen(PORT, () => console.log("🚀 Tamil Pro Max 7.4.1 Live"));
