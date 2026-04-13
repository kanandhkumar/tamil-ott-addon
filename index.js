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
  version: "2.1.0",
  description: "Tamil movies & series from Sun NXT, ZEE5, JioHotstar, Aha, MX Player, Sony LIV",
  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Tamil_language_logo.svg/200px-Tamil_language_logo.svg.png",
  resources: ["catalog"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  behaviorHints: { adult: false, p2p: false },
  catalogs: [
    { id: "sunnxt_movies",     type: "movie",  name: "Sun NXT – Tamil Movies",         extra: [{ name: "skip", isRequired: false }] },
    { id: "zee5_movies",       type: "movie",  name: "ZEE5 – Tamil Movies",             extra: [{ name: "skip", isRequired: false }] },
    { id: "jiohotstar_movies", type: "movie",  name: "JioHotstar – Tamil Movies",       extra: [{ name: "skip", isRequired: false }] },
    { id: "aha_movies",        type: "movie",  name: "Aha Tamil – Movies",              extra: [{ name: "skip", isRequired: false }] },
    { id: "mxplayer_movies",   type: "movie",  name: "Amazon MX Player – Tamil Movies", extra: [{ name: "skip", isRequired: false }] },
    { id: "sonyliv_movies",    type: "movie",  name: "Sony LIV – Tamil Movies",         extra: [{ name: "skip", isRequired: false }] },
    { id: "kalaignar_movies",  type: "movie",  name: "Kalaignar TV – Tamil Movies",     extra: [{ name: "skip", isRequired: false }] },
    { id: "sunnxt_series",     type: "series", name: "Sun NXT – Tamil Series",          extra: [{ name: "skip", isRequired: false }] },
    { id: "zee5_series",       type: "series", name: "ZEE5 – Tamil Series",             extra: [{ name: "skip", isRequired: false }] },
    { id: "jiohotstar_series", type: "series", name: "JioHotstar – Tamil Series",       extra: [{ name: "skip", isRequired: false }] },
    { id: "aha_series",        type: "series", name: "Aha Tamil – Series",              extra: [{ name: "skip", isRequired: false }] },
    { id: "sonyliv_series",    type: "series", name: "Sony LIV – Tamil Series",         extra: [{ name: "skip", isRequired: false }] },
  ],
};

// ── Verified Tamil IMDB IDs per platform (fallback) ───────────────────────────
const PLATFORM_MOVIES = {
  sunnxt:     ["tt6016236","tt8143610","tt7144870","tt6719968","tt9764938","tt10837246","tt9032398","tt12412888","tt15655792","tt14539740","tt11035246","tt9032400","tt8367814","tt6712648","tt15671028","tt13121618","tt16365614","tt7504726","tt8108198","tt9019536"],
  zee5:       ["tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt15671028","tt9032398","tt16365614","tt11035246","tt14539740","tt6016236","tt8143610","tt7144870","tt6719968","tt15655792","tt13121618","tt12412888"],
  jiohotstar: ["tt13121618","tt15655792","tt14539740","tt6016236","tt8143610","tt9019536","tt10399902","tt12412888","tt9032398","tt15671028","tt7144870","tt6719968","tt8367814","tt6712648","tt9764938","tt9032400","tt8108198","tt7504726","tt16365614","tt11035246"],
  aha:        ["tt9032398","tt15671028","tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt6016236","tt8143610","tt7144870","tt6719968","tt13121618","tt15655792","tt14539740","tt12412888","tt16365614","tt11035246"],
  mxplayer:   ["tt10399902","tt9019536","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt6016236","tt8143610","tt7144870","tt6719968","tt9032398","tt15671028","tt13121618","tt15655792","tt14539740","tt12412888","tt16365614","tt11035246"],
  kalaignar:  ["tt6719968","tt7144870","tt8143610","tt6016236","tt9764938","tt10837246","tt8108198","tt7504726","tt9032400","tt6712648","tt8367814","tt9019536","tt10399902","tt15671028","tt9032398","tt13121618","tt15655792","tt14539740","tt12412888","tt16365614"],
  sonyliv:    ["tt8367814","tt6712648","tt9764938","tt10399902","tt9019536","tt15671028","tt9032398","tt8108198","tt7504726","tt9032400","tt6016236","tt8143610","tt7144870","tt6719968","tt13121618","tt15655792","tt14539740","tt12412888","tt16365614","tt11035246"],
};

const PLATFORM_SERIES = {
  sunnxt:     ["tt8291224","tt14519434","tt9032401","tt12077116","tt15256628","tt14444952","tt11847842","tt10954984","tt13615776","tt8291220"],
  zee5:       ["tt14519434","tt9032401","tt8291224","tt8291220","tt11847842","tt10954984","tt15256628","tt14444952","tt13615776","tt12077116"],
  jiohotstar: ["tt8291224","tt14519434","tt12077116","tt9032401","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt8291220"],
  aha:        ["tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  mxplayer:   ["tt11847842","tt10954984","tt15256628","tt14444952","tt13615776","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  sonyliv:    ["tt9032401","tt8291220","tt8291224","tt14519434","tt12077116","tt10954984","tt11847842","tt15256628","tt14444952","tt13615776"],
};

// ── TMDB fetch with retry ─────────────────────────────────────────────────────
const metaCache = new Map();

async function tmdbFetch(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TamilOTT/2.0)" },
      });
      if (res.ok) return res.json();
      console.log(`TMDB attempt ${attempt} failed: ${res.status}`);
    } catch (e) {
      console.log(`TMDB attempt ${attempt} error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return null;
}

async function getMeta(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  if (!TMDB_KEY) return null;

  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbFetch(
    `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=en-US`
  );

  if (!data) { metaCache.set(imdbId, null); return null; }

  const r = data[`${mediaType}_results`]?.[0];
  if (!r?.poster_path) { metaCache.set(imdbId, null); return null; }

  // Reject non-Tamil
  if (r.original_language && r.original_language !== "ta") {
    console.log(`Rejected ${imdbId}: lang=${r.original_language}`);
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
}

// ── Gemini (no Google Search — basic prompt only) ─────────────────────────────
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

  // Simple prompt without Google Search (more reliable on free tier)
  const prompt =
    `List 15 ${kind} available on ${name} India in ${year-1} or ${year}. ` +
    `Only original Tamil language content, not dubbed. ` +
    `Return ONLY a JSON array of IMDB IDs like: ["tt6016236","tt15655792"]. ` +
    `No explanation, just the array.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
        }),
        timeout: 15000,
      }
    );
    if (!res.ok) { console.error("Gemini HTTP", res.status); return null; }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;
    const ids = JSON.parse(match[0]).filter(id => /^tt\d{7,8}$/.test(id));
    if (ids.length < 3) return null;
    console.log(`Gemini ${key}: ${ids.slice(0,5).join(",")}`);
    geminiCache.set(key, { data: ids, ts: Date.now() });
    return ids;
  } catch (e) {
    console.error("Gemini error:", e.message);
    return null;
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────────
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
    const isMovie  = subtype === "movies";

    // Try Gemini first, fall back to curated list
    let ids = await askGemini(platform, subtype);
    if (!ids || ids.length < 3) {
      ids = isMovie
        ? (PLATFORM_MOVIES[platform] || PLATFORM_MOVIES.sunnxt)
        : (PLATFORM_SERIES[platform] || PLATFORM_SERIES.sunnxt);
    }

    // Fetch metadata in batches of 5
    const results = [];
    for (let i = 0; i < Math.min(ids.length, 20); i += 5) {
      const batch = await Promise.all(ids.slice(i, i+5).map(id => getMeta(id, type)));
      results.push(...batch.filter(Boolean));
    }

    res.json({ metas: results });
  } catch (err) {
    console.error("Catalog error:", err.message);
    res.json({ metas: [] });
  }
});

// Debug
app.get("/debug/:platform/:subtype", async (req, res) => {
  const { platform, subtype } = req.params;
  const result = {
    platform, subtype,
    tmdb_key: !!TMDB_KEY,
    gemini_key: !!GEMINI_KEY,
  };

  try {
    const ids = await askGemini(platform, subtype);
    result.gemini_ids   = ids;
    result.gemini_count = ids ? ids.length : 0;
  } catch (e) { result.gemini_error = e.message; }

  try {
    const meta = await getMeta("tt6016236", "movie");
    result.tmdb_test = meta ? `OK - ${meta.name} - ${meta.poster}` : "FAILED";
  } catch (e) { result.tmdb_error = e.message; }

  res.json(result);
});

app.get("/health", (req, res) => res.json({ status: "ok", version: manifest.version }));

app.listen(PORT, () => console.log(`Tamil OTT Addon live on port ${PORT}`));
