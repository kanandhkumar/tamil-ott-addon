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
    console.log(`🌞 Refreshing Global Tamil Library (From ${startDate})...`);

    try {
        // Net 1: Original Tamil movies (Popularity sort)
        const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc&region=IN`;
        
        // Net 2: Trending movies in India (Hollywood/Dubbed hits)
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&certification_country=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        // Net 3: Tamil Web Series
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`;

        const [resM, resD, resS] = await Promise.all([fetch(movieUrl), fetch(dubbedUrl), fetch(seriesUrl)]);
        const dataM = await resM.json();
        const dataD = await resD.json();
        const dataS = await resS.json();

        // Combine and de-duplicate movies
        const combinedMovies = [...(dataM.results || []), ...(dataD.results || [])];
        const uniqueItems = Array.from(new Map(combinedMovies.map(m => [m.id, m])).values());

        // Process IDs (Convert to IMDb for playback)
        const movieResults = [];
        for (const item of uniqueItems.slice(0, 80)) { // Increased limit to 80 for more variety
            const playable = await convertToPlayable(item, 'movie');
            if (playable) movieResults.push(playable);
            await delay(40);
        }

        const seriesResults = [];
        for (const item of (dataS.results || []).slice(0, 40)) {
            const playable = await convertToPlayable(item, 'tv');
            if (playable) seriesResults.push(playable);
            await delay(40);
        }

        dailyTamilList.movies = movieResults;
        dailyTamilList.series = seriesResults;
        
        console.log(`✅ Library Refreshed! Total Movies: ${dailyTamilList.movies.length}`);
    } catch (e) {
        console.error("❌ Refresh failed:", e.message);
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
        id: "com.anandh.tamil.global",
        version: "6.4.0",
        name: "Tamil Global 2025",
        description: "Tamil Originals + Hollywood/Indian Dubbed Hits.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tg_movies", type: "movie", name: "Tamil & Dubbed Hits (2025+)" },
            { id: "tg_series", type: "series", name: "Tamil Web Series" }
        ],
        idPrefixes: ["tt", "tmdb"]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const list = req.params.type === "movie" ? dailyTamilList.movies : dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.4.0 Global Tamil Active"));
