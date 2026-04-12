const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const GENRE_MAP = {
  Action:28, Drama:18, Comedy:35, Thriller:53, Romance:10749,
  Horror:27, Family:10751, "Sci-Fi":878, Animation:16, Crime:80,
  Reality:10764, News:10763, Devotional:null,
};

const PLATFORM_MOVIES = {
  sunnxt:    ["tt6016236","tt8143610","tt7144870","tt13121618","tt15655792","tt14539740","tt12412888","tt9032398","tt6719968","tt3263904","tt9764938","tt6712648","tt10399902","tt8367814","tt9019536","tt15671028","tt5078116","tt8108198","tt7504726","tt9032400"],
  zee5:      ["tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt3263904","tt6016236","tt15655792","tt14539740","tt13121618","tt12412888","tt9032398","tt8143610","tt7144870","tt6719968","tt5078116","tt15671028"],
  hotstar:   ["tt13121618","tt15655792","tt14539740","tt6016236","tt8143610","tt9019536","tt10399902","tt12412888","tt9032398","tt15671028","tt7144870","tt6719968","tt8367814","tt6712648","tt9764938","tt3263904","tt9032400","tt8108198","tt7504726","tt5078116"],
  aha:       ["tt9032398","tt15671028","tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt3263904","tt6016236","tt8143610","tt7144870","tt6719968","tt13121618","tt15655792","tt14539740","tt12412888","tt5078116"],
  mxplayer:  ["tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400","tt6016236","tt8143610","tt7144870","tt6719968","tt3263904","tt5078116","tt9032398","tt15671028","tt13121618","tt15655792","tt14539740","tt12412888"],
  kalaignar: ["tt3263904","tt6016236","tt8143610","tt7144870","tt9019536","tt8108198","tt9032400","tt7504726","tt6719968","tt5078116","tt10399902","tt8367814","tt6712648","tt9764938","tt15671028","tt9032398","tt12412888","tt13121618","tt15655792","tt14539740"],
  sonyliv:   ["tt8367814","tt6712648","tt9764938","tt10399902","tt9019536","tt15671028","tt9032398","tt8108198","tt7504726","tt9032400","tt6016236","tt8143610","tt7144870","tt6719968","tt3263904","tt13121618","tt15655792","tt14539740","tt12412888","tt5078116"],
};

const PLATFORM_SERIES = {
  sunnxt:    ["tt8291224","tt14519434","tt9032401","tt12077116","tt8291220","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984"],
  zee5:      ["tt14519434","tt9032401","tt8291224","tt12077116","tt8291220","tt11847842","tt10954984","tt15256628","tt14444952","tt13615776"],
  hotstar:   ["tt8291224","tt14519434","tt12077116","tt9032401","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt8291220"],
  aha:       ["tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  mxplayer:  ["tt11847842","tt10954984","tt15256628","tt14444952","tt13615776","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  kalaignar: ["tt8291224","tt14519434","tt9032401","tt12077116","tt8291220","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984"],
  sonyliv:   ["tt9032401","tt8291220","tt8291224","tt14519434","tt12077116","tt10954984","tt11847842","tt15256628","tt14444952","tt13615776"],
};

const PLATFORM_WEBSERIES = {
  sunnxt:    ["tt8291224","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt14519434","tt9032401","tt12077116","tt8291220"],
  zee5:      ["tt14519434","tt11847842","tt10954984","tt15256628","tt14444952","tt13615776","tt8291224","tt9032401","tt12077116","tt8291220"],
  hotstar:   ["tt8291224","tt14519434","tt12077116","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt9032401","tt8291220"],
  aha:       ["tt15256628","tt14444952","tt13615776","tt11847842","tt10954984","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  mxplayer:  ["tt11847842","tt10954984","tt15256628","tt14444952","tt13615776","tt8291224","tt14519434","tt12077116","tt9032401","tt8291220"],
  kalaignar: ["tt8291224","tt14519434","tt9032401","tt12077116","tt8291220","tt15256628","tt14444952","tt13615776","tt11847842","tt10954984"],
  sonyliv:   ["tt9032401","tt8291220","tt10954984","tt11847842","tt15256628","tt14444952","tt13615776","tt8291224","tt14519434","tt12077116"],
};

const PLATFORM_SHORTS = {
  sunnxt:    ["tt9019536","tt8108198","tt7504726","tt9032400","tt8367814","tt6712648","tt9764938","tt10399902","tt15671028","tt9032398"],
  zee5:      ["tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt15671028","tt9032398","tt8108198","tt7504726","tt9032400"],
  hotstar:   ["tt9019536","tt10399902","tt13121618","tt15655792","tt14539740","tt12412888","tt9032398","tt15671028","tt8367814","tt6712648"],
  aha:       ["tt9032398","tt15671028","tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt8108198","tt7504726","tt9032400"],
  mxplayer:  ["tt9019536","tt10399902","tt8367814","tt6712648","tt9764938","tt15671028","tt9032398","tt8108198","tt7504726","tt9032400"],
  kalaignar: ["tt9019536","tt8108198","tt7504726","tt9032400","tt3263904","tt6016236","tt8143610","tt7144870","tt6719968","tt5078116"],
  sonyliv:   ["tt8367814","tt6712648","tt9764938","tt10399902","tt9019536","tt15671028","tt9032398","tt8108198","tt7504726","tt9032400"],
};

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

async function getMetaForImdb(imdbId, type) {
  if (metaCache.has(imdbId)) return metaCache.get(imdbId);
  const mediaType = type === "movie" ? "movie" : "tv";
  const findRes = await tmdbGet(`/find/${imdbId}`, { external_source: "imdb_id" });
  if (!findRes) return null;
  const results = findRes[`${mediaType}_results`] || [];
  if (!results.length) return null;
  const tmdbId = results[0].id;
  const detail = await tmdbGet(`/${mediaType}/${tmdbId}`);
  if (!detail) return null;
  const poster = detail.poster_path ? `${TMDB_IMG}${detail.poster_path}` : null;
  if (!poster) return null;
  const meta = {
    id: imdbId, type,
    name: detail.title || detail.name || "Unknown",
    poster,
    background: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : undefined,
    description: detail.overview || undefined,
    releaseInfo: (detail.release_date || detail.first_air_date || "").slice(0, 4) || undefined,
    genres: (detail.genres || []).map(g => g.name).filter(Boolean),
    imdbRating: detail.vote_average ? String(parseFloat(detail.vote_average).toFixed(1)) : undefined,
  };
  metaCache.set(imdbId, meta);
  return meta;
}

async function searchTmdb(type, query, page, genre) {
  const mediaType = type === "movie" ? "movie" : "tv";
  if (query) {
    const data = await tmdbGet(`/search/${mediaType}`, { query, page, with_original_language: "ta" });
    if (!data || !data.results) return [];
    return (data.results || []).filter(r => r.original_language === "ta" && r.poster_path).slice(0, 20).map(r => ({
      id: `tmdb:${r.id}`, type, name: r.title || r.name,
      poster: `${TMDB_IMG}${r.poster_path}`,
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
    }));
  }
  const params = { page, with_original_language: "ta", sort_by: "popularity.desc" };
  if (genre && GENRE_MAP[genre]) params.with_genres = GENRE_MAP[genre];
  const data = await tmdbGet(`/discover/${mediaType}`, params);
  if (!data || !data.results) return [];
  return (data.results || []).filter(r => r.poster_path).slice(0, 20).map(r => ({
    id: `tmdb:${r.id}`, type, name: r.title || r.name,
    poster: `${TMDB_IMG}${r.poster_path}`,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4),
  }));
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const skip     = parseInt(extra.skip || 0);
  const page     = Math.floor(skip / 20) + 1;
  const genre    = extra.genre || null;
  const search   = extra.search || null;
  const platform = catalogId.split("_")[0];
  const subtype  = catalogId.replace(`${platform}_`, "");

  if (search) return searchTmdb(type, search, page, genre);

  let idList = [];
  if      (subtype === "movies")    idList = PLATFORM_MOVIES[platform]    || [];
  else if (subtype === "series")    idList = PLATFORM_SERIES[platform]    || [];
  else if (subtype === "webseries") idList = PLATFORM_WEBSERIES[platform] || [];
  else if (subtype === "shorts")    idList = PLATFORM_SHORTS[platform]    || [];

  const pageIds = idList.slice(skip, skip + 20);
  if (!pageIds.length) return [];

  if (TMDB_KEY) {
    const metas = await Promise.all(pageIds.map(id => getMetaForImdb(id, type)));
    let filtered = metas.filter(Boolean);
    if (genre) filtered = filtered.filter(m => m.genres && m.genres.includes(genre));
    return filtered;
  }

  return pageIds.map(id => ({ id, type, name: id }));
}

module.exports = { fetchCatalog };
