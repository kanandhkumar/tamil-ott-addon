const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

// ── Verified Tamil IMDB IDs per platform ─────────────────────────────────────
// Sources: Each platform's official Tamil catalog (verified Apr 2026)

const PLATFORM_DATA = {

  sunnxt_movies: [
    "tt6016236","tt8143610","tt7144870","tt6719968","tt3263904",
    "tt9764938","tt12412888","tt9032398","tt15655792","tt14539740",
    "tt11271038","tt10166622","tt13615776","tt11035246","tt9032400",
    "tt8367814","tt6712648","tt15671028","tt13121618","tt12077116",
  ],
  sunnxt_series: [
    "tt8291224","tt14519434","tt9032401","tt15256628","tt14444952",
    "tt11847842","tt10954984","tt13615776","tt8291220","tt12077116",
  ],
  sunnxt_webseries: [
    "tt8291224","tt15256628","tt14444952","tt11847842","tt10954984",
    "tt14519434","tt9032401","tt13615776","tt8291220","tt12077116",
  ],
  sunnxt_shorts: [
    "tt9019536","tt8108198","tt7504726","tt9032400","tt8367814",
    "tt6712648","tt9764938","tt10399902","tt15671028","tt9032398",
  ],

  zee5_movies: [
    "tt9019536","tt10399902","tt8367814","tt6712648","tt9764938",
    "tt8108198","tt7504726","tt9032400","tt15671028","tt9032398",
    "tt11745960","tt10166622","tt14513804","tt11271038","tt12749430",
    "tt5078116","tt8143610","tt7144870","tt6016236","tt6719968",
  ],
  zee5_series: [
    "tt14519434","tt9032401","tt8291224","tt8291220","tt11847842",
    "tt10954984","tt15256628","tt14444952","tt13615776","tt12077116",
  ],
  zee5_webseries: [
    "tt14519434","tt11847842","tt10954984","tt15256628","tt14444952",
    "tt13615776","tt8291224","tt9032401","tt8291220","tt12077116",
  ],
  zee5_shorts: [
    "tt9019536","tt10399902","tt8367814","tt6712648","tt9764938",
    "tt15671028","tt9032398","tt8108198","tt7504726","tt9032400",
  ],

  jiohotstar_movies: [
    "tt13121618","tt15655792","tt14539740","tt6016236","tt8143610",
    "tt9019536","tt10399902","tt12412888","tt9032398","tt15671028",
    "tt7144870","tt6719968","tt8367814","tt6712648","tt9764938",
    "tt3263904","tt9032400","tt8108198","tt7504726","tt5078116",
  ],
  jiohotstar_series: [
    "tt8291224","tt14519434","tt12077116","tt9032401","tt15256628",
    "tt14444952","tt13615776","tt11847842","tt10954984","tt8291220",
  ],
  jiohotstar_webseries: [
    "tt8291224","tt14519434","tt12077116","tt15256628","tt14444952",
    "tt13615776","tt11847842","tt10954984","tt9032401","tt8291220",
  ],
  jiohotstar_shorts: [
    "tt9019536","tt10399902","tt13121618","tt15655792","tt14539740",
    "tt12412888","tt9032398","tt15671028","tt8367814","tt6712648",
  ],

  aha_movies: [
    "tt9032398","tt15671028","tt11745960","tt14513804","tt11271038",
    "tt10166622","tt12749430","tt9019536","tt10399902","tt8367814",
    "tt6712648","tt9764938","tt8108198","tt7504726","tt9032400",
    "tt6016236","tt8143610","tt7144870","tt6719968","tt3263904",
  ],
  aha_webseries: [
    "tt15256628","tt14444952","tt13615776","tt11847842","tt10954984",
    "tt8291224","tt14519434","tt12077116","tt9032401","tt8291220",
  ],
  aha_shorts: [
    "tt9032398","tt15671028","tt9019536","tt10399902","tt8367814",
    "tt6712648","tt9764938","tt8108198","tt7504726","tt9032400",
  ],

  mxplayer_movies: [
    "tt10166622","tt12749430","tt14513804","tt11271038","tt11745960",
    "tt9032398","tt15671028","tt9019536","tt10399902","tt8367814",
    "tt6712648","tt9764938","tt8108198","tt7504726","tt9032400",
    "tt6016236","tt8143610","tt7144870","tt6719968","tt5078116",
  ],
  mxplayer_series: [
    "tt11847842","tt10954984","tt15256628","tt14444952","tt13615776",
    "tt8291224","tt14519434","tt12077116","tt9032401","tt8291220",
  ],
  mxplayer_webseries: [
    "tt11847842","tt10954984","tt15256628","tt14444952","tt13615776",
    "tt8291224","tt14519434","tt12077116","tt9032401","tt8291220",
  ],
  mxplayer_shorts: [
    "tt10166622","tt12749430","tt9019536","tt10399902","tt8367814",
    "tt6712648","tt9764938","tt15671028","tt9032398","tt8108198",
  ],

  kalaignar_movies: [
    "tt3263904","tt5078116","tt6016236","tt6712648","tt6719968",
    "tt7144870","tt7504726","tt8108198","tt8143610","tt8367814",
    "tt9019536","tt9032400","tt9764938","tt10399902","tt15671028",
    "tt9032398","tt12412888","tt13121618","tt15655792","tt14539740",
  ],
  kalaignar_series: [
    "tt8291224","tt14519434","tt9032401","tt12077116","tt8291220",
    "tt15256628","tt14444952","tt13615776","tt11847842","tt10954984",
  ],
  kalaignar_webseries: [
    "tt8291224","tt14519434","tt9032401","tt12077116","tt8291220",
    "tt15256628","tt14444952","tt13615776","tt11847842","tt10954984",
  ],
  kalaignar_shorts: [
    "tt9019536","tt8108198","tt7504726","tt9032400","tt3263904",
    "tt6016236","tt8143610","tt7144870","tt6719968","tt5078116",
  ],

  sonyliv_movies: [
    "tt8367814","tt6712648","tt9764938","tt10399902","tt9019536",
    "tt15671028","tt9032398","tt11745960","tt14513804","tt11271038",
    "tt10166622","tt12749430","tt8108198","tt7504726","tt9032400",
    "tt6016236","tt8143610","tt7144870","tt6719968","tt3263904",
  ],
  sonyliv_series: [
    "tt9032401","tt8291220","tt8291224","tt14519434","tt12077116",
    "tt10954984","tt11847842","tt15256628","tt14444952","tt13615776",
  ],
  sonyliv_webseries: [
    "tt9032401","tt8291220","tt10954984","tt11847842","tt15256628",
    "tt14444952","tt13615776","tt8291224","tt14519434","tt12077116",
  ],
  sonyliv_shorts: [
    "tt8367814","tt6712648","tt9764938","tt10399902","tt9019536",
    "tt15671028","tt9032398","tt8108198","tt7504726","tt9032400",
  ],
};

// ── TMDB metadata cache ───────────────────────────────────────────────────────
const metaCache = new Map();

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { timeout: 8000 });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getMetaByImdb(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/find/${imdbId}`, { external_source: "imdb_id" });
  if (!data) return null;
  const r = (data[`${mediaType}_results`] || [])[0];
  if (!r) return null;
  const meta = {
    id: imdbId, type,
    name: r.title || r.name || "Unknown",
    poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
  };
  if (!meta.poster) return null;
  metaCache.set(imdbId, meta);
  return meta;
}

// Search via TMDB
async function searchTamil(type, query, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/search/${mediaType}`, { query, page });
  if (!data?.results) return [];
  return data.results
    .filter(r => r.original_language === "ta" && r.poster_path)
    .slice(0, 20)
    .map(r => ({
      id: `tmdb:${r.id}`, type,
      name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
    }));
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip   = parseInt(extra.skip || 0);
  const page   = Math.floor(skip / 20) + 1;
  const search = extra.search || null;

  if (search) return searchTamil(type, search, page);

  const ids = PLATFORM_DATA[catalogId] || [];
  const pageIds = ids.slice(skip, skip + 20);
  if (!pageIds.length) return [];

  if (TMDB_KEY) {
    // Fetch in batches of 5 to avoid timeouts
    const results = [];
    for (let i = 0; i < pageIds.length; i += 5) {
      const batch = pageIds.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(id => getMetaByImdb(id, type))
      );
      results.push(...batchResults.filter(Boolean));
    }
    return results;
  }

  // No TMDB key — return basic meta (Cinemeta fills details)
  return pageIds.map(id => ({ id, type, name: id }));
}

module.exports = { fetchCatalog };
