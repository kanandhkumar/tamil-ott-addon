const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { movies: [], series: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    console.log(`🌞 Refreshing Library: Newest to Oldest (From ${startDate})...`);

    try {
        // --- 1. FETCH DATA ---
        // Movies: Original Tamil + Popular in India (Dubbed)
        const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&region=IN`;
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&certification_country=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`;

        // Series: Original Tamil Web Series
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [resM, resD, resS] = await Promise.all([fetch(movieUrl), fetch(dubbedUrl), fetch(seriesUrl)]);
        const dataM = await resM.json();
        const dataD = await resD.json();
        const dataS = await resS.json();

        // --- 2. MERGE & SORT BY DATE (Strict Newest First) ---
        const combinedMovies = [...(dataM.results || []), ...(dataD.results || [])];
        
        // Remove duplicates and sort strictly by release date descending
        const sortedMovies = Array.from(new Map(combinedMovies.map(m => [m.id, m])).values())
            .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        const sortedSeries = (dataS.results || [])
            .sort((a, b) => new Date(b.first_air_date) - new Date(a.first_air_date));

        // --- 3. PROCESS WITH INCREASED LIMITS ---
        // Movies: increased to 60, Series: increased to 50
        const movieResults = [];
        for (const item of sortedMovies.slice(0, 60)) {
            const playable = await convertToPlayable(item, 'movie');
            if (playable) movieResults.push(playable);
            await delay(40);
        }

        const seriesResults = [];
        for (const item of sortedSeries.slice(0, 50)) {
            const playable = await convertToPlayable(item, 'tv');
            if (playable) seriesResults.push(playable);
            await delay(40);
        }

        dailyTamilList.movies = movieResults;
        dailyTamilList.series = seriesResults;
        
        console.log(`✅ Update Successful! Movies: ${dailyTamilList.movies.length}, Series: ${dailyTamilList.series.length}`);
    } catch (e) {
        console.error("❌ Update failed:", e.message);
    }
}

async function convertToPlayable(item, type) {
    try {
        const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const res = await fetch(idUrl);
        const ids = await res.json();
        const finalId = ids.imdb_id || `tmdb:${item.id}`;

        return {
            id: finalId,
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
        id: "com.anandh.tamil.latest.final",
        version: "6.5.0",
        name: "Tamil Latest (2025-26)",
        description: "Newest Tamil & Dubbed releases first.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tl_movies", type: "movie", name: "Latest Tamil & Dubbed (2025+)" },
            { id: "tl_series", type: "series", name: "Latest Tamil Web Series" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const list = req.params.type === "movie" ? dailyTamilList.movies : dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.5.0 Strict Latest Live"));
