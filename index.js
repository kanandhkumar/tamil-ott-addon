const express = require("express");
const fetch   = require("node-fetch");
const app     = express();

const TMDB_KEY   = process.env.TMDB_API_KEY   || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const PORT       = process.env.PORT            || 10000;

// ── Manifest ──────────────────────────────────────────────────────────────────
const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "2.0.0",
  description: "Tamil movies & series from Sun NXT, ZEE5, JioHotstar, Aha, MX Player, Sony LIV",
  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Tamil_language_logo.svg/200px-Tamil_language_logo.svg.png",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  behaviorHints: { adult: false, p2p: false },
  catalogs: [
    { id: "sunnxt_movies",       type: "movie",  name: "Sun NXT – Tamil Movies",        extra: [{ name: "skip", isRequired: false }] },
    { id: "zee5_movies",         type: "movie",  name: "ZEE5 – Tamil Movies",            extra: [{ name: "skip", isRequired: false }] },
    { id: "jiohotstar_movies",   type: "movie",  name: "JioHotstar – Tamil Movies",      extra: [{ name: "skip", isRequired: false }] },
    { id: "aha_movies",          type: "movie",  name: "Aha Tamil – Movies",             extra: [{ name: "skip", isRequired: false }] },
    { id: "mxplayer_movies",     type: "movie",  name: "Amazon MX Player – Tamil Movies",extra: [{ name: "skip", isRequired: false }] },
    { id: "sonyliv_movies",      type: "movie",  name: "Sony LIV – Tamil Movies",        extra: [{ name: "skip", isRequired: false }] },
    { id: "kalaignar_movies",    type: "movie",  name: "Kalaignar TV – Tamil Movies",    extra: [{ name: "skip", isRequired: false }] },
    { id: "sunnxt_series",       type: "series", name: "Sun NXT – Tamil Series",         extra: [{ name: "skip", isRequired: false }] },
    { id: "zee5_series",         type: "series", name: "ZEE5 – Tamil Series",            extra: [{ name: "skip", isRequired: false }] },
    { id: "jiohotstar_series",   type: "series", name: "JioHotstar – Tamil Series",      extra: [{ name: "skip", isRequired: false }] },
    { id: "aha_series",          type: "series", name: "Aha Tamil – Series",             extra: [{ name: "skip", isRequired: false }] },
    { id: "sonyliv_series",      type: "series", name: "Sony LIV – Tamil Series",        extra: [{ name: "skip", isRequired: false }] },
  ],
};

// ── Verified Tamil fallback IDs ────────────────────────────────────────────────
const FALLBACK_MOVIES = [
  "tt6016236","tt15655792","tt14539740","tt13121618","tt8143610",
  "tt7144870","tt10399902","tt9019536","tt8367814","tt6712648",
  "tt9764938","tt8108198","tt7504726","tt9032400","tt6719968",
  "tt9032398","tt15671028","tt12412888","tt16365614","tt11035246",
];
const FALLBACK_SERIES = [
  "tt8291224","tt14519434","tt9032401","tt12077116","tt15256628",
  "tt14444952","tt11847842","tt10954984","tt13615776","tt8291220",
];
function rotateFallback(arr, platform) {
  const n = {sunnxt:0,zee5:4,jiohotstar:8,aha:12,mxplayer:3,kalaignar:7,sonyliv:10}[platform]||0;
  return [...arr.slice(n), ...arr.slice(0,n)];
}

// ── TMDB metadata ─────────────────────────────────────────────────────────────
const metaCache = new Map();

async function getMeta(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  if (!TMDB_KEY) return null;

  try {
    const mediaType = type === "movie" ? "movie" : "tv";
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`;
    const res  = await fetch(url, { timeout: 8000 });
    const data = await res.json();
    const r    = data[`${mediaType}_results`]?.[0];

    if (!r?.poster_path) { metaCache.set(imdbId, null); return null; }

    // Reject non-Tamil content
    if (r.original_language && r.original_language !== "ta") {
      console.log(`Rejected ${imdbId} (${r.title||r.name}) lang=${r.original_language}`);
      metaCache.set(imdbId, null);
      return null;
    }

    const meta = {
      id:          imdbId,
      type,
      name:        r.title || r.name || "Tamil Content",
      poster:      `https://image.tmdb.org/t/p/w500${r.poster_path}`,
      background:  r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
      description: r.overview   || undefined,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0,4) || undefined,
      imdbRating:  r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
    };
    metaCache.set(imdbId, meta);
    return meta;
  } catch (e) {
    console.error("getMeta error:", imdbId, e.message);
    return null;
  }
}

// ── Gemini with Google Search ─────────────────────────────────────────────────
const geminiCache = new Map();
const GEMINI_TTL  = 12 * 60 * 60 * 1000;
const PLATFORM_NAMES = {
  sunnxt:"Sun NXT", zee5:"ZEE5", jiohotstar:"JioHotstar",
  aha:"Aha Tamil", mxplayer:"Amazon MX Player",
  kalaignar:"Kalaignar TV", sonyliv:"Sony LIV",
};

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null;
  const key = `${platform}_${subtype}`;
  const hit = geminiCache.get(key);
  if (hit && Date.now() - hit.ts < GEMINI_TTL) return hit.data;

  const name = PLATFORM_NAMES[platform] || platform;
  const year = new Date().getFullYear();
  const kind = subtype === "series" ? "Tamil web series and TV shows" : "Tamil movies";

  const prompt =
    `Search the web and list 15 ${kind} from ${year-1} or ${year} ` +
    `available on ${name} India. ` +
    `Return ONLY a JSON array of IMDB IDs (format ttXXXXXXX). ` +
    `Only include original Tamil language content, not dubbed. ` +
    `Example: ["tt6016236","tt15655792"]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
          tools: [{ googleSearch: {} }],
        }),
        timeout: 20000,
      }
    );
    if (!res.ok) { console.error("Gemini HTTP", res.status); return null; }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;
    const ids = JSON.parse(match[0]).filter(id => /^tt\d{7,8}$/.test(id));
    if (ids.length < 3) return null;
    console.log(`Gemini ${key}: ${ids.join(",")}`);
    geminiCache.set(key, { data: ids, ts: Date.now() });
    return ids;
  } catch (e) {
    console.error("Gemini error:", e.message);
    return null;
  }
}

// ── CORS middleware ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/manifest.json"));

app.get("/manifest.json", (req, res) => res.json(manifest));

app.get("/catalog/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const platform = id.split("_")[0];
    const subtype  = id.includes("series") ? "series" : "movies";

    // Try Gemini first
    let ids = await askGemini(platform, subtype);

    // Fallback
    if (!ids || ids.length < 3) {
      ids = rotateFallback(
        subtype === "series" ? FALLBACK_SERIES : FALLBACK_MOVIES,
        platform
      );
    }

    // Fetch metadata in batches of 5
    const results = [];
    for (let i = 0; i < Math.min(ids.length, 20); i += 5) {
      const batch = await Promise.all(ids.slice(i, i+5).map(id => getMeta(id, type)));
      results.push(...batch.filter(Boolean));
    }

    // If still empty, use fallback directly
    if (results.length === 0) {
      const fb = rotateFallback(
        subtype === "series" ? FALLBACK_SERIES : FALLBACK_MOVIES,
        platform
      );
      const fbResults = await Promise.all(fb.slice(0,10).map(id => getMeta(id, type)));
      return res.json({ metas: fbResults.filter(Boolean) });
    }

    res.json({ metas: results });
  } catch (err) {
    console.error("Catalog error:", err.message);
    res.json({ metas: [] });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", version: manifest.version }));

app.listen(PORT, () => console.log(`Tamil OTT Addon live on port ${PORT}`));

// ── Debug endpoint ────────────────────────────────────────────────────────────
app.get("/debug/:platform/:subtype", async (req, res) => {
  const { platform, subtype } = req.params;
  const result = { platform, subtype, tmdb_key: !!TMDB_KEY, gemini_key: !!GEMINI_KEY };

  // Test Gemini
  try {
    const ids = await askGemini(platform, subtype);
    result.gemini_ids = ids;
    result.gemini_count = ids ? ids.length : 0;
  } catch (e) {
    result.gemini_error = e.message;
  }

  // Test TMDB with one known Tamil ID
  try {
    const testId = "tt6016236"; // Vikram
    const meta = await getMeta(testId, "movie");
    result.tmdb_test = meta ? `OK - ${meta.name}` : "FAILED - no result";
  } catch (e) {
    result.tmdb_error = e.message;
  }

  res.json(result);
});
