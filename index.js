const express = require("express");
const https = require("https");

const app = express();
const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { cinema: [], tMovies: [], tSeries: [], dMovies: [], dSeries: [], eMovies: [], eSeries: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

function fetchNative(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject).setTimeout(10000, function() { this.destroy(); });
    });
}

async function fetchAllPages(url, pages = 3) {
    let results = [];
    for (let p = 1; p <= pages; p++) {
        try {
            const data = await fetchNative(`${url}&page=${p}`);
            if (data.results) results = results.concat(data.results);
            await delay(500); 
        } catch (e) { console.error(`⚠️ Page ${p} failed: ${e.message}`); }
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
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    masterList.tMovies = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=ta&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc`, 3), 'movie');
    masterList.tSeries = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=ta&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=first_air_date.desc`, 3), 'tv');
    masterList.eMovies = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_original_language=en&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}&sort_by=popularity.desc`, 3), 'movie');
    masterList.eSeries = await processItems(await fetchAllPages(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_original_language=en&first_air_date.gte=${startDate}&first_air_date.lte=${today}&sort_by=popularity.desc`, 3), 'tv');
    
    const indLangs = ["hi", "te", "ml", "kn"];
    const rawIndMovies = await fetchMultiLang(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&primary_release_date.gte=${startDate}&primary_release_date.lte=${today}`, indLangs, 2);
    rawIndMovies.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
    masterList.dMovies = await processItems(rawIndMovies, 'movie');
    
    const rawIndSeries = await fetchMultiLang(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&with_origin_country=IN&first_air_date.gte=${startDate}&first_air_date.lte=${today}`, indLangs, 2);
    rawIndSeries.sort((a, b) => new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0));
    masterList.dSeries = await processItems(rawIndSeries, 'tv');
    
    const cinemaData = await fetchMultiLang(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&region=IN&with_release_type=3&primary_release_date.gte=${sixtyDaysAgo}&primary_release_date.lte=${today}`, ["ta", "hi", "te", "ml", "kn"], 2);
    masterList.cinema = await processItems(cinemaData.filter(m => m.poster_path).sort((a, b) => new Date(b.release_date) - new Date(a.release_date)).slice(0, 50), 'movie', true);
}

async function processItems(items, type, isCinema = false) {
    const list = [];
    for (const item of items) {
        try {
            const data = await fetchNative(`https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`);
            const date = type === 'movie' ? item.release_date : item.first_air_date;
            list.push({
                id: data.imdb_id || `tmdb:${item.id}`,
                name: isCinema ? `${item.title || item.name} 🎬 [IN CINEMA]` : (item.title || item.name),
                type: type === 'tv' ? 'series' : type,
                poster: data.imdb_id ? `https://btttr.cc/poster-q/imdb/poster-default/${data.imdb_id}.jpg` : `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                releaseInfo: date ? date.slice(0, 4) : '',
                description: item.overview || `📅 ${date}`,
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
        id: "com.anandh.tamil.v8.cinema", version: "8.5.0", name: "Tamil Pro Max (v8.5.0)",
        resources: ["catalog"], types: ["movie", "series"],
        catalogs: [
            { id: "tamil_cinema", type: "movie", name: "🎬 Now In Cinemas" },
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series" },
            { id: "ind_dub_m", type: "movie", name: "New Indian Dubbed Movies" },
            { id: "ind_dub_s", type: "series", name: "New Indian Dubbed Series" },
            { id: "eng_dub_m", type: "movie", name: "Hollywood Hits (Tamil Dub)" },
            { id: "eng_dub_s", type: "series", name: "Hollywood Series (Tamil Dub)" }
        ]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const lists = { tamil_cinema: masterList.cinema, pure_tamil_m: masterList.tMovies, pure_tamil_s: masterList.tSeries, ind_dub_m: masterList.dMovies, ind_dub_s: masterList.dSeries, eng_dub_m: masterList.eMovies, eng_dub_s: masterList.eSeries };
    const skip = parseInt(req.query.skip || 0);
    res.json({ metas: (lists[req.params.id] || []).slice(skip, skip + 50) });
});

app.listen(PORT, () => console.log(`🚀 Live v8.5.0 on port ${PORT}`));
