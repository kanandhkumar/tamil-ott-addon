const express = require("express");
const https = require("https");
const { getWeeklyTamilOttTitles } = require("./geminiOttFetcher");

const app = express();
const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

let masterList = { cinema: [], tMovies: [], tSeries: [], dMovies: [], dSeries: [], eMovies: [], eSeries: [], weeklyOtt: [] };
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

// Normalize a title for comparison: lowercase, strip punctuation/spaces
function normalizeTitle(str) {
    return (str || "")
        .toLowerCase()
        .replace(/&/g, "and")     // "Parimala & Co" should match "Parimala and Co"
        .replace(/[^a-z0-9]/g, "");
}

// Reject a TMDB result if its title doesn't reasonably match the searched title.
// This guards against TMDB's fuzzy search returning an unrelated "closest guess"
// (e.g. searching "Isakapatnam" incorrectly matching an unrelated 1974 short film).
function isReasonableMatch(queryTitle, resultTitle) {
    const q = normalizeTitle(queryTitle);
    const r = normalizeTitle(resultTitle);
    if (!q || !r) return false;
    if (q === r) return true;
    // Accept if one contains the other (handles subtitle/suffix differences)
    if (q.length >= 4 && (q.includes(r) || r.includes(q))) return true;
    return false;
}

async function searchTmdbForTitle(title) {
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, "").trim(); 
    for (const type of ["movie", "tv"]) {
        try {
            const data = await fetchNative(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}&include_adult=false`);
            if (data.results && data.results.length) {
                // Check the top few results for a genuinely matching title, not just result[0]
                const match = data.results.slice(0, 5).find(r => isReasonableMatch(cleanTitle, r.title || r.name));
                if (match) {
                    return { item: match, type };
                } else {
                    console.warn(`⚠️ TMDB had results for "${cleanTitle}" (${type}) but none matched closely enough — e.g. top hit was "${data.results[0].title || data.results[0].name}"`);
                }
            }
        } catch (e) {
            console.error(`⚠️ TMDB search error for "${cleanTitle}" (${type}): ${e.message}`);
        }
    }
    return null;
}

// Check TMDB watch/providers (IN region) — returns the actual streaming platform, or null if not confirmed
async function getIndiaStreamingProvider(tmdbId, type) {
    try {
        const data = await fetchNative(`https://api.themoviedb.org/3/${type}/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`);
        const inData = data.results && data.results.IN;
        if (!inData) return null;
        const providers = inData.flatrate || inData.ads || inData.free;
        if (!providers || !providers.length) return null;
        return providers[0].provider_name;
    } catch (e) {
        return null;
    }
}

async function updateWeeklyOtt() {
    try {
        console.log("🔄 Weekly OTT sync started...");
        const titles = await getWeeklyTamilOttTitles();
        console.log(`📋 Gemini returned ${titles.length} candidate titles: ${titles.join(", ")}`);

        const enriched = [];
        for (const title of titles) {
            try {
                const found = await searchTmdbForTitle(title);
                if (!found) {
                    console.warn(`⚠️ No TMDB match for "${title}" — dropped`);
                    await delay(150);
                    continue;
                }

                const { item, type } = found;
                const releaseDateStr = type === 'movie' ? item.release_date : item.first_air_date;

                // Recency is now judged solely by "confirmed streaming in India right now" —
                // TMDB's release_date field proved unreliable for smaller titles (e.g. Balti was
                // off by ~290 days), so it's kept for display only, never as a rejection reason.
                const platform = await getIndiaStreamingProvider(item.id, type);
                if (!platform) {
                    console.warn(`⚠️ "${title}" matched TMDB, but no confirmed India streaming provider yet — dropped`);
                    await delay(150);
                    continue;
                }

                const externalIds = await fetchNative(`https://api.themoviedb.org/3/${type}/${item.id}/external_ids?api_key=${TMDB_KEY}`);
                enriched.push({
                    id: externalIds.imdb_id || `tmdb:${item.id}`,
                    name: `${item.title || item.name} (${platform})`,
                    type: "movie",
                    poster: externalIds.imdb_id
                        ? `https://btttr.cc/poster-q/imdb/poster-default/${externalIds.imdb_id}.jpg`
                        : (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined),
                    releaseInfo: releaseDateStr ? releaseDateStr.slice(0, 4) : '',
                    description: `📺 Streaming on ${platform} • ${releaseDateStr || ''}\n\n${item.overview || ''}`
                });
                await delay(200);
            } catch (e) {
                console.error(`⚠️ Error processing "${title}": ${e.message}`);
            }
        }
        console.log(`✅ Weekly OTT: ${enriched.length}/${titles.length} candidate titles verified and added`);
        if (enriched.length > 0) masterList.weeklyOtt = enriched;
    } catch (e) { console.error("❌ Weekly OTT failed:", e.message); }
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
updateWeeklyOtt();
setInterval(updateDailyList, 12 * 60 * 60 * 1000);
setInterval(updateWeeklyOtt, 24 * 60 * 60 * 1000);

app.get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
        id: "com.anandh.tamil.v8.cinema", version: "8.5.0", name: "Tamil Pro Max (v8.5.0)",
        resources: ["catalog"], types: ["movie", "series"],
        catalogs: [
            { id: "tamil_cinema", type: "movie", name: "🎬 Now In Cinemas" },
            { id: "pure_tamil_m", type: "movie", name: "New Tamil Movies" },
            { id: "pure_tamil_s", type: "series", name: "New Tamil Series" },
            { id: "weekly_ott", type: "movie", name: "📺 Recent Tamil OTT (3 Wks)" },
            { id: "ind_dub_m", type: "movie", name: "New Indian Dubbed Movies" },
            { id: "ind_dub_s", type: "series", name: "New Indian Dubbed Series" },
            { id: "eng_dub_m", type: "movie", name: "Hollywood Hits (Tamil Dub)" },
            { id: "eng_dub_s", type: "series", name: "Hollywood Series (Tamil Dub)" }
        ]
    });
});

app.get("/catalog/:type/:id.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const lists = { tamil_cinema: masterList.cinema, pure_tamil_m: masterList.tMovies, pure_tamil_s: masterList.tSeries, weekly_ott: masterList.weeklyOtt, ind_dub_m: masterList.dMovies, ind_dub_s: masterList.dSeries, eng_dub_m: masterList.eMovies, eng_dub_s: masterList.eSeries };
    const skip = parseInt(req.query.skip || 0);
    res.json({ metas: (lists[req.params.id] || []).slice(skip, skip + 50) });
});

app.listen(PORT, () => console.log(`🚀 Live v8.5.0 on port ${PORT}`));
