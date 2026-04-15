const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { movies: [], series: [] };

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    console.log(`🌞 Updating Playable Library (From ${startDate})...`);

    try {
        const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&region=IN`;
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [resM, resS] = await Promise.all([fetch(movieUrl), fetch(seriesUrl)]);
        const dataM = await resM.json();
        const dataS = await resS.json();

        // Convert TMDB IDs to IMDb IDs so they can play
        dailyTamilList.movies = await Promise.all((dataM.results || []).slice(0, 40).map(i => convertToPlayable(i, 'movie')));
        dailyTamilList.series = await Promise.all((dataS.results || []).slice(0, 30).map(i => convertToPlayable(i, 'tv')));

        dailyTamilList.movies = dailyTamilList.movies.filter(Boolean);
        dailyTamilList.series = dailyTamilList.series.filter(Boolean);
        
        console.log(`✅ Ready to play! Movies: ${dailyTamilList.movies.length}, Series: ${dailyTamilList.series.length}`);
    } catch (e) {
        console.error("❌ Update failed:", e.message);
    }
}

async function convertToPlayable(item, type) {
    try {
        const idUrl = `https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`;
        const res = await fetch(idUrl);
        const ids = await res.json();
        
        // If no IMDb ID, Torrentio won't find it, so we skip or use TMDB
        const finalId = ids.imdb_id || `tmdb:${item.id}`;

        return {
            id: finalId,
            name: item.title || item.name,
            type: type === 'movie' ? 'movie' : 'series',
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            description: `📅 ${item.release_date || item.first_air_date} | ⭐ ${item.vote_average}`
        };
    } catch (e) { return null; }
}

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.playable",
        version: "6.3.0",
        name: "Tamil Playable 2025",
        description: "Tamil hits linked to stream providers.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tm_2025", type: "movie", name: "Tamil Movies 2025" },
            { id: "ts_2025", type: "series", name: "Tamil Series 2025" }
        ],
        idPrefixes: ["tt"] // Crucial: Tells Stremio we use IMDb IDs
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const list = req.params.type === "movie" ? dailyTamilList.movies : dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.listen(PORT, () => console.log("🚀 v6.3.0 Playable Live"));
