const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { 
    tMovies: [], tSeries: [], 
    dMovies: [], dSeries: [], 
    eMovies: [], eSeries: [],
    cinema: []  // ← NEW: Now in cinemas
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

// ── Cinema: check if a movie is still in theatres ─────────────────────────────
async function isInCinemas(tmdbId) {
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${TMDB_KEY}`;
        const res  = await fetch(url);
        const data = await res.json();

        // Check India (IN) first, then global
        const regions = ["IN", "US"];
        for (const region of regions) {
            const entry = data.results?.find(r => r.iso_3166_1 === region);
            if (!entry) continue;
            const hasTheatrical = entry.release_dates.some(r => r.type === 3); // 3 = Theatrical
            const hasDigital    = entry.release_dates.some(r => r.type === 4 || r.type === 6); // 4=Digital 6=TV
            if (hasTheatrical && !hasDigital) return true;
        }
        return false;
    } catch { return false; }
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const regionalLangs = "hi|te|ml|kn";

    console.log(`🔄 Sync Started: ${today}`);

    try {
        // 1. PURE TAMIL
        const tMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const tSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        // 2. INDIAN REGIONAL DUBBED
        const indMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=${regionalLangs}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;
        const indSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&with_original_language=${regionalLangs}&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        // 3. ENGLISH HITS
        const engMovieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;
        const engSeriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        // 4. NOW IN CINEMAS (Tamil + Regional — TMDB now_playing IN region)
        const cinemaUrl = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=en-US&region=IN`;

        const [rawTM, rawTS, rawIndM, rawIndS, rawEngM, rawEngS, rawCinema] = await Promise.all([
            fetchAllPages(tMovieUrl),
            fetchAllPages(tSeriesUrl),
            fetchAllPages(indMovieUrl, 3),
            fetchAllPages(indSeriesUrl, 3),
            fetchAllPages(engMovieUrl, 3),
            fetchAllPages(engSeriesUrl, 3),
            fetchAllPages(cinemaUrl, 2),
        ]);

        // Process all rows
        masterList.tMovies = await processItems(rawTM.slice(0, 50), 'movie');
        masterList.tSeries = await processItems(rawTS.slice(0, 50), 'tv');
        masterList.dMovies = await processItems(rawIndM.slice(0, 50), 'movie');
        masterList.dSeries = await processItems(rawIndS.slice(0, 50), 'tv');
        masterList.eMovies = await processItems(rawEngM.slice(0, 50), 'movie');
        masterList.eSeries = await processItems(rawEngS.slice(0, 50), 'tv');

        // Cinema: filter to Indian languages + verify still in theatres
        const indianLangs = ["ta", "hi", "te", "ml", "kn"];
        const cinemaFiltered = rawCinema.filter(m =>
            indianLangs.includes(m.original_language) && m.poster_path
        );
        masterList.cinema = await processItemsCinema(cinemaFiltered.slice(0, 30));

        console.log(`✅ Sync done! Cinema: ${masterList.cinema.length} titles`);
    } catch (e) { console.error("Sync failed", e); }
}

async function processItems(items, type) {
    const list = [];
    for (const item of items) {
        const p = await convertToPlayable(item, type, false);
        if (p) list.push(p);
        await delay(20);
    }
    return list;
}

async function processItemsCinema(items) {
    const list = [];
    for (const item of items) {
        const p = await convertToPlayable(item, 'movie', true);
        if (p) list.push(p);
        await delay(30);
    }
    return list;
}

async function convertToPlayable(item, type, cinema = false) {
    try {
        const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const res = await fetch(idUrl);
        const ids = await res.json();
        const date = type === 'movie' ? item.release_date : item.first_air_date;

        // For cinema row, verify it's actually still in theatres
        if (cinema) {
            const stillInCinemas = await isInCinemas(item.id);
            if (!stillInCinemas) return null;
        }

        return {
            id:          ids.imdb_id || `tmdb:${item.id}`,
            name:        item.title || item.name,
            type:        type === 'movie' ? 'movie' : 'series',
            poster:      item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            description: `📅 ${date || 'N/A'} | ⭐ ${item.vote_average || 'N/A'}${cinema ? ' | 🎬 In Cinemas' : ''}`,
            // Stremio shows this tag on the poster card
            releaseInfo: date ? date.slice(0, 4) : undefined,
            // Genre trick: Stremio displays first genre as a badge
            genres:      cinema ? ["IN CINEMAS"] : undefined,
        };
    } catch (e) { return null; }
}

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.v7.pop",
        version: "7.4.0",
        name: "Tamil Pro Max 2025",
        description: "7 Rows - Tamil, Dubbed, Hollywood & Cinema",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tamil_cinema",  type: "movie",  name: "🎬 Now In Cinemas" },
            { id: "pure_tamil_m",  type: "movie",  name: "New Tamil Movies (Pure)" },
            { id: "pure_tamil_s",  type: "series", name: "New Tamil Series (Pure)" },
            { id: "ind_dub_m",     type: "movie",  name: "New Indian Dubbed Movies" },
            { id: "ind_dub_s",     type: "series", name: "New Indian Dubbed Series" },
            { id: "eng_dub_m",     type: "movie",  name: "Hollywood Hits (Tamil Dub)" },
            { id: "eng_dub_s",     type: "series", name: "Hollywood Series (Tamil Dub)" }
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
    status: "ok",
    cinema: masterList.cinema.length,
    tMovies: masterList.tMovies.length,
}));

app.listen(PORT, () => console.log("🚀 Tamil Pro Max 7.4.0 Live"));
