const express = require("express");
const fetch = require("node-fetch");
const app = express();

const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let dailyTamilList = { movies: [], series: [] };

async function updateDailyList() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startDate = "2025-01-01";
    
    console.log(`🌞 Refreshing Tamil Library (Range: ${startDate} to ${today})...`);

    try {
        // 1. Movies: Original Tamil + Popular in India (Dubbed)
        const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&region=IN`;
        const dubbedUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&certification_country=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`;

        // 2. Series: Original Tamil Series
        const seriesUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`;

        const [resM, resD, resS] = await Promise.all([
            fetch(movieUrl),
            fetch(dubbedUrl),
            fetch(seriesUrl)
        ]);

        const dataM = await resM.json();
        const dataD = await resD.json();
        const dataS = await resS.json();

        // Merge and clean Movie list
        const combinedMovies = [...(dataM.results || []), ...(dataD.results || [])];
        const uniqueMovies = Array.from(new Map(combinedMovies.map(m => [m.id, m])).values());

        dailyTamilList.movies = uniqueMovies.slice(0, 60).map(formatTMDB);
        dailyTamilList.series = (dataS.results || []).slice(0, 40).map(formatTMDB);
        
        console.log(`✅ Success! Movies: ${dailyTamilList.movies.length}, Series: ${dailyTamilList.series.length}`);
    } catch (e) {
        console.error("❌ Auto-update failed:", e.message);
    }
}

function formatTMDB(item) {
    return {
        id: `tmdb:${item.id}`,
        name: item.title || item.name,
        type: item.title ? "movie" : "series",
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        description: `📅 ${item.release_date || item.first_air_date} | ⭐ ${item.vote_average || 'N/A'}`
    };
}

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000); 

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.ultimate",
        version: "6.2.1",
        name: "Tamil Cinema 2025+",
        description: "Auto-updating Tamil originals and dubbed hits.",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tamil_movies", type: "movie", name: "Tamil Movies (2025-Present)" },
            { id: "tamil_series", type: "series", name: "Tamil Series (2025-Present)" }
        ]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const list = req.params.type === "movie" ? dailyTamilList.movies : dailyTamilList.series;
    res.json({ metas: list || [] });
});

app.get("/", (req, res) => res.status(200).send("Tamil Ultimate 6.2.1 is Online"));

app.listen(PORT, () => console.log(`🚀 v6.2.1 active`));
