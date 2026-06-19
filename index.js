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

// 🛡️ SEQUENTIAL RETRY LOGIC: Prevents network saturation crashes
async function fetchAllPages(url, pages = 2) {
    let results = [];
    for (let p = 1; p <= pages; p++) {
        let success = false;
        let attempts = 0;
        while (!success && attempts < 3) {
            try {
                attempts++;
                const res = await fetch(`${url}&page=${p}`, { headers: { 'Connection': 'keep-alive' } });
                const data = await res.json();
                if (data.results) results = results.concat(data.results);
                success = true;
            } catch (e) {
                console.error(`⚠️ Attempt ${attempts} failed for ${url} page ${p}:`, e.message);
                await delay(2000);
            }
        }
    }
    return results;
}

async function fetchMultiLang(baseUrl, langs, pages = 2) {
    let combined = [];
    for (const lang of langs) {
        const data = await fetchAllPages(`${baseUrl}&with_original_language=${lang}`, pages);
        combined = combined.concat(data);
    }
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
}

async function updateDailyList() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = "2025-01-01";
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`🔄 Sync Started: ${today}`);

    try {
        // Sequentially fetching data to ensure network stability
        masterList.tMovies = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`, 2), 'movie');
        masterList.tSeries = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`, 2), 'tv');
        
        masterList.eMovies = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`, 3), 'movie');
        masterList.eSeries = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`, 3), 'tv');

        const indLangs = ["hi", "te", "ml", "kn"];
        masterList.dMovies = await processItems(await fetchMultiLang(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&with_release_type=4&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}`, indLangs, 2), 'movie');
        masterList.dSeries = await processItems(await fetchMultiLang(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&first_air_date.gte=${startDate}&first_air_date.lte=${today}`, indLangs, 2), 'tv');
        
        const cinemaData = await fetchMultiLang(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&with_release_type=3&primary_release_date.gte=${sixtyDaysAgo}&primary_release_date.lte=${today}`, ["ta", "hi", "te", "ml", "kn"], 2);
        masterList.cinema = await processItems(cinemaData.filter(m => m.poster_path).sort((a, b) => new Date(b.release_date) - new Date(a.release_date)).slice(0, 40), 'movie', true);

        console.log("✅ Sync Complete.");
    } catch (e) { console.error("Sync failed", e); }
}

async function processItems(items, type, isCinema = false) {
    const list = [];
    for (const item of items) {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`);
            const ids = await res.json();
            const date = type === 'movie' ? item.release_date : item.first_air_date;
            
            list.push({
                id: ids.imdb_id || `tmdb:${item.id}`,
                name: isCinema ? `${item.title || item.name} 🎬 [IN CINEMA]` : (item.title || item.name),
                type: type,
                poster: ids.imdb_id ? `https://btttr.cc/poster-q/imdb/poster-default/${ids.imdb_id}.jpg` : `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                releaseInfo: date ? date.slice(0, 4) : '',
                released: date ? new Date(date).toISOString() : undefined,
                imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
                description: item.overview || `📅 ${date}`,
                inTheaters: isCinema ? true : undefined
            });
            await delay(50);
        } catch (e) { continue; }
    }
    return list;
}

updateDailyList();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.v8.cinema",
        version: "8.3.0",
        name: "Tamil Pro Max (v8.3)",
        resources: ["catalog"],
        types: ["movie", "series"],
        catalogs: [
            { id: "tamil_cinema",  type: "movie",  name: "🎬 Now In Cinemas" },
            { id: "pure_tamil_m",  type: "movie",  name: "New Tamil Movies" },
            { id: "pure_tamil_s",  type: "series", name: "New Tamil Series" },
            { id: "ind_dub_m",     type: "movie",  name: "New Indian Dubbed Movies" },
            { id: "ind_dub_s",     type: "series", name: "New Indian Dubbed Series" },
            { id: "eng_dub_m",     type: "movie",  name: "Hollywood Hits (Tamil Dub)" },
            { id: "eng_dub_s",     type: "series", name: "Hollywood Series (Tamil Dub)" }
        ]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const lists = { tamil_cinema: masterList.cinema, pure_tamil_m: masterList.tMovies, pure_tamil_s: masterList.tSeries, ind_dub_m: masterList.dMovies, ind_dub_s: masterList.dSeries, eng_dub_m: masterList.eMovies, eng_dub_s: masterList.eSeries };
    res.json({ metas: (lists[req.params.id] || []).slice(parseInt(req.query.skip || 0), parseInt(req.query.skip || 0) + 20) });
});

app.listen(PORT, () => console.log("🚀 Live v8.3.0"));
