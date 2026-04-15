const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { movies: [], series: [] };

async function updateDailyList() {
    console.log("🌞 Starting daily Tamil content scan...");
    try {
        // 1. Original Tamil Movies (Latest)
        const urlOrig = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&sort_by=primary_release_date.desc&region=IN`;
        
        // 2. Dubbed/Popular in India (To find dubbed Hollywood/South hits)
        const urlDubbed = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&certification_country=IN&sort_by=popularity.desc&with_runtime.gte=60`;

        const [resO, resD, resS] = await Promise.all([
            fetch(urlOrig),
            fetch(urlDubbed),
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&sort_by=first_air_date.desc`)
        ]);

        const dataO = await resO.json();
        const dataD = await resD.json();
        const dataS = await resS.json();

        // Combine and remove duplicates
        const combinedMovies = [...(dataO.results || []), ...(dataD.results || [])];
        const uniqueMovies = Array.from(new Map(combinedMovies.map(m => [m.id, m])).values());

        dailyTamilList.movies = uniqueMovies.slice(0, 40).map(formatTMDB);
        dailyTamilList.series = (dataS.results || []).slice(0, 20).map(formatTMDB);
        
        console.log(`✅ Scan Complete. Total unique items: ${dailyTamilList.movies.length}`);
    } catch (e) {
        console.error("❌ Scan failed:", e.message);
    }
}

function formatTMDB(item) {
    return {
        id: `tmdb:${item.id}`,
        name: item.title || item.name,
        type: item.title ? "movie" : "series",
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        description: `Release: ${item.release_date || item.first_air_date}`
    };
}

// Initial update and schedule
updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000); 

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.daily.tamil",
        version: "6.1.0",
        name: "Daily Tamil OTT",
        description: "Auto-refreshing Tamil Originals & Dubbed content.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tamil_movies", type: "movie", name: "Tamil Movies (New & Dubbed)" },
            { id: "tamil_series", type: "series", name: "Tamil Web Series" }
        ]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const list = req.params.type === "movie" ? dailyTamilList.movies : dailyTamilList.series;
    res.json({ metas: list });
});

app.get("/", (req, res) => res.status(200).send("Daily Tamil Addon is Active"));

app.listen(PORT, () => console.log(`🚀 Addon running on port ${PORT}`));
