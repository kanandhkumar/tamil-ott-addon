const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

// JustWatch GraphQL API (unofficial, no key needed)
const JW_API = "https://apis.justwatch.com/graphql";

// JustWatch provider IDs for India
const JW_PROVIDERS = {
  sunnxt:     "sun_nxt",
  zee5:       "zee5",
  jiohotstar: "hotstar",
  aha:        "aha",
  mxplayer:   "mxplayer",
  kalaignar:  "kalaignar_tv",
  sonyliv:    "sonyliv",
};

const GENRE_MAP = {
  Action:"ACTION", Drama:"DRAMA", Comedy:"COMEDY", Thriller:"THRILLER",
  Romance:"ROMANCE", Horror:"HORROR", Family:"FAMILY", "Sci-Fi":"SCIENCE_FICTION",
  Animation:"ANIMATION", Crime:"CRIME",
};

// Cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

// TMDB metadata cache
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
  if (!r?.poster_path) return null;
  const meta = {
    id: imdbId, type,
    name: r.title || r.name || "Unknown",
    poster: `${TMDB_IMG}${r.poster_path}`,
    background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
  };
  metaCache.set(imdbId, meta);
  return meta;
}

// Query JustWatch GraphQL for Tamil content by provider
async function jwQuery(provider, contentType, page, genre) {
  const offset = (page - 1) * 20;
  const jwType = contentType === "movie" ? "MOVIE" : "SHOW";
  const genreFilter = genre && GENRE_MAP[genre] ? `genres: ["${GENRE_MAP[genre]}"]` : "";

  const query = `{
    popularTitles(
      country: "IN"
      first: 20
      offset: ${offset}
      filter: {
        objectTypes: [${jwType}]
        packages: ["${provider}"]
        languages: ["ta"]
        ${genreFilter}
      }
      sortBy: POPULAR
      sortRandomSeed: 0
    ) {
      edges {
        node {
          id
          objectType
          content(country: "IN", language: "en") {
            title
            originalReleaseYear
            externalIds {
              imdbId
            }
            posterUrl(profile: S718, format: JPG)
            backdropUrl(profile: S1920, format: JPG)
            shortDescription
            genres { translation(language: "en") }
            scoring { imdbScore }
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch(JW_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      timeout: 12000,
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function jwNodeToMeta(node, type) {
  if (!node?.content) return null;
  const c = node.content;
  const imdbId = c.externalIds?.imdbId;
  if (!imdbId) return null;
  const poster = c.posterUrl || null;
  if (!poster) return null;
  return {
    id: imdbId,
    type,
    name: c.title || "Unknown",
    poster,
    background: c.backdropUrl || undefined,
    description: c.shortDescription || undefined,
    releaseInfo: c.originalReleaseYear ? String(c.originalReleaseYear) : undefined,
    imdbRating: c.scoring?.imdbScore ? String(parseFloat(c.scoring.imdbScore).toFixed(1)) : undefined,
    genres: c.genres?.map(g => g.translation).filter(Boolean) || [],
  };
}

// TMDB discover fallback - Tamil language
async function tmdbDiscover(type, page) {
  const mediaType = type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/discover/${mediaType}`, {
    page,
    with_original_language: "ta",
    sort_by: "popularity.desc",
    "vote_count.gte": 20,
  });
  if (!data?.results) return [];
  const results = await Promise.all(
    data.results
      .filter(r => r.original_language === "ta" && r.poster_path)
      .slice(0, 20)
      .map(async r => {
        const ext = await tmdbGet(`/${mediaType}/${r.id}/external_ids`);
        const imdbId = ext?.imdb_id;
        if (!imdbId) return null;
        return {
          id: imdbId, type,
          name: r.title || r.name,
          poster: `${TMDB_IMG}${r.poster_path}`,
          background: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
          description: r.overview || undefined,
          releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
          imdbRating: r.vote_average ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
        };
      })
  );
  return results.filter(Boolean);
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip     = parseInt(extra.skip || 0);
  const page     = Math.floor(skip / 20) + 1;
  const genre    = extra.genre || null;
  const search   = extra.search || null;
  const platform = catalogId.split("_")[0];
  const mediaType = type === "movie" ? "movie" : "tv";

  if (search) return tmdbDiscover(type, page);

  const cacheKey = `${catalogId}:${page}:${genre || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const provider = JW_PROVIDERS[platform];
  let results = [];

  // Try JustWatch GraphQL first
  if (provider) {
    const data = await jwQuery(provider, mediaType, page, genre);
    const edges = data?.data?.popularTitles?.edges || [];
    if (edges.length > 0) {
      results = edges.map(e => jwNodeToMeta(e.node, type)).filter(Boolean);
    }
  }

  // Fallback to TMDB discover
  if (!results.length) {
    results = await tmdbDiscover(type, page);
  }

  cache.set(cacheKey, { data: results, ts: Date.now() });
  return results;
}

module.exports = { fetchCatalog };
