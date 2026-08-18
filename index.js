const express = require("express");
const https = require("https");
const sharp = require("sharp");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");

const app = express();
const TMDB_KEY = process.env.TMDB_API_KEY;
const PORT = process.env.PORT || 10000;

const posterCache = new NodeCache({ stdTTL: 24 * 60 * 60, maxKeys: 500 });
let masterList = { cinema: [], tMovies: [], tSeries: [], dMovies: [], dSeries: [], eMovies: [], eSeries: [] };
const delay = ms => new Promise(res => setTimeout(res, ms));

// ==========================================
// RELATIVE RELEASE TIME CALCULATOR
// ==========================================
function getRelativeRelease(dateString, isCinema) {
    if (!dateString) return '';
    const releaseDate = new Date(dateString);
    const today = new Date();
    const diffDays = Math.round((today - releaseDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Upcoming";
    if (diffDays <= 7) return "This Week";
    if (diffDays <= 14) return "1 Week Ago";
    if (diffDays <= 21) return "2 Weeks Ago";
    if (diffDays <= 30) return "3 Weeks Ago";
    if (diffDays <= 60) return "1 Month Ago";
    if (diffDays <= 90) return "2 Months Ago";
    
    return isCinema ? "In Cinemas" : "OTT Released";
}

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
                _posterPath: item.poster_path,
                _btttrPoster: data.imdb_id ? `https://btttr.cc/poster-q/imdb/poster-default/${data.imdb_id}.jpg` : null,
                _isCinema: isCinema,
                _lang: item.original_language,
                _rating: item.vote_average ? item.vote_average.toFixed(1) : '',
                _relativeTime: getRelativeRelease(date, isCinema), // Store time dynamically
                description: item.overview || `📅 Original Release: ${date}`,
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
        id: "com.anandh.tamil.v8.cinema", version: "8.8.0", name: "Tamil Pro Max",
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

app.get(["/catalog/:type/:id.json", "/catalog/:type/:id/:extra.json"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const hostUrl = `${protocol}://${req.get('host')}`;
    
    const lists = { tamil_cinema: masterList.cinema, pure_tamil_m: masterList.tMovies, pure_tamil_s: masterList.tSeries, ind_dub_m: masterList.dMovies, ind_dub_s: masterList.dSeries, eng_dub_m: masterList.eMovies, eng_dub_s: masterList.eSeries };
    
    let skip = 0;
    if (req.params.extra) {
        const match = req.params.extra.match(/skip=(\d+)/);
        if (match) skip = parseInt(match[1], 10);
    }
    
    const rawMetas = (lists[req.params.id] || []).slice(skip, skip + 50);
    
    const langMap = { 'ta': 'TAMIL', 'te': 'TELUGU', 'hi': 'HINDI', 'ml': 'MALAYALAM', 'kn': 'KANNADA', 'en': 'ENGLISH' };

    const metas = rawMetas.map(m => {
        const langName = langMap[m._lang] || 'TAMIL';
        const printType = m._isCinema ? 'CAM' : 'HD'; 
        
        // NEW LOGIC: Badge gets the relative time, Release Info gets the Print/Lang
        const badgeText = m._relativeTime; 
        const subtitleText = `${printType}, ${langName}`;
        
        const baseImage = m._posterPath ? `https://image.tmdb.org/t/p/w500${m._posterPath}` : m._btttrPoster;

        // v=8 Cache buster
        const posterUrl = baseImage 
            ? `${hostUrl}/poster-badge?v=8&badge=${encodeURIComponent(badgeText)}&rating=${encodeURIComponent(m._rating)}&url=${encodeURIComponent(baseImage)}`
            : null;

        return {
            id: m.id,
            type: m.type,
            name: m.name,
            poster: posterUrl,
            releaseInfo: subtitleText, // Puts "HD, TAMIL" right under the title
            description: m.description
        };
    });
    
    res.json({ metas });
});

// ==========================================
// INTERNAL POSTER BADGING ROUTE
// ==========================================
function createBadgeSvg(text) {
    const cleanText = (text || '').toUpperCase();
    const width = Math.max(160, cleanText.length * 20 + 48); // Auto-expands to fit longer text like "1 MONTH AGO"
    const height = 64; 
    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.75"/>
            </filter>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="12" ry="12" fill="#ffffff" filter="url(#shadow)"/>
        <text x="${width / 2}" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="1" fill="#111827" text-anchor="middle">${cleanText}</text>
    </svg>
    `;
}

function createRatingSvg(rating) {
    if (!rating || rating === '0.0') return null;
    const text = `★ ${rating}`;
    return `
    <svg width="130" height="54" viewBox="0 0 130 54" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="shadow-r" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
            </filter>
        </defs>
        <rect x="0" y="0" width="130" height="54" rx="10" ry="10" fill="#f5c518" filter="url(#shadow-r)"/>
        <text x="65" y="37" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="900" fill="#000000" text-anchor="middle">${text}</text>
    </svg>
    `;
}

app.get('/poster-badge', async (req, res) => {
    const { url, badge, rating } = req.query;
    if (!url) return res.status(400).send('Missing image URL');

    const cacheKey = `${url}::${badge}::${rating}`;
    const cached = posterCache.get(cacheKey);
    
    if (cached) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(cached);
    }

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok) throw new Error(`Failed to fetch`);
        const imageBuffer = await response.buffer();

        const cleanText = (badge || '').toUpperCase();
        const badgeWidth = Math.max(160, cleanText.length * 20 + 48);

        const composites = [
            { input: Buffer.from(createBadgeSvg(badge)), top: 12, left: 500 - badgeWidth - 12 }
        ];
        
        const ratingSvg = createRatingSvg(rating);
        if (ratingSvg) {
            composites.push({ input: Buffer.from(ratingSvg), top: 750 - 54 - 16, left: 16 });
        }

        const composited = await sharp(imageBuffer)
            .resize(500, 750, { fit: 'cover' })
            .composite(composites)
            .jpeg({ quality: 85 })
            .toBuffer();

        posterCache.set(cacheKey, composited);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(composited);
    } catch (err) {
        res.redirect(url);
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`🚀 Live v8.8.0 on port ${PORT}`));
