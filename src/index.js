const { addonBuilder } = require('@stremiocloud/addon-sdk');
const fetch = require('node-fetch');

const builder = new addonBuilder({
  id: 'com.kanand.tamilott',
  name: 'Tamil OTT',
  version: '1.0.0',
  description: 'Tamil content from SunNXT, ZEE5, Hotstar, Aha, SonyLIV',
  resources: ['catalog', 'meta'],
  types: ['movie', 'series']
});

const TMDB_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

// Provider to TMDb sort/year mapping (fallback to TMDb since JustWatch wrapper needs work)
const PROVIDER_CONFIG = {
  sunnxt: { sort: 'popularity.desc', year: '2022-01-01' },
  zee5: { sort: 'vote_average.desc', year: '2021-01-01' },
  hotstar: { sort: 'popularity.desc', year: '2023-01-01' },
  aha: { sort: 'primary_release_date.desc', year: '2022-01-01' },
  mxplayer: { sort: 'revenue.desc', year: '2021-01-01' },
  sonyliv: { sort: 'vote_average.desc', year: '2021-01-01' }
};

async function tmdbGet(path, params = {}) {
  if (!TMDB_KEY) return null;
  
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'en-US');
  
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function getImdbId(tmdbId, mediaType) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, { 
    append_to_response: 'external_ids' 
  });
  return data?.external_ids?.imdb_id || null;
}

function buildMeta(data, type) {
  if (!data?.poster_path || data.original_language !== 'ta') return null;
  
  return {
    id: data.id, // Use TMDb ID as fallback
    type,
    name: data.title || data.name || 'Unknown',
    poster: `${TMDB_IMG}${data.poster_path}`,
    background: data.backdrop_path 
      ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` 
      : undefined,
    description: data.overview,
    releaseInfo: (data.release_date || data.first_air_date || '').slice(0, 4),
    imdbRating: data.vote_average ? data.vote_average.toFixed(1) : undefined
  };
}

async function fetchCatalogTamil(type, provider, page, genre) {
  const mediaType = type === 'movie' ? 'movie' : 'tv';
  const config = PROVIDER_CONFIG[provider] || {};
  
  const params = {
    page,
    with_original_language: 'ta',
    sort_by: config.sort || 'popularity.desc',
    'vote_count.gte': 10
  };

  // Provider-specific filtering
  if (config.year) {
    const dateKey = mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
    params[dateKey] = config.year;
  }

  if (genre && GENRE_MAP[genre]) {
    params.with_genres = GENRE_MAP[genre];
  }

  const data = await tmdbGet(`/discover/${mediaType}`, params);
  
  if (!data?.results?.length) return [];

  const items = data.results.filter(item => item.poster_path && item.original_language === 'ta');
  
  const metas = await Promise.all(
    items.slice(0, 20).map(async (item) => {
      const imdbId = await getImdbId(item.id, mediaType);
      if (imdbId) {
        return { ...buildMeta(item, type), id: imdbId };
      }
      return buildMeta(item, type);
    })
  );

  return metas.filter(Boolean);
}

// Genre mapping
const GENRE_MAP = {
  Action: 28, Drama: 18, Comedy: 35, Thriller: 53, Romance: 10749,
  Horror: 27, Family: 10751, 'Sci-Fi': 878, Animation: 16, Crime: 80
};

// Catalog handler
builder.defineCatalogHandler(async (args) => {
  const { extra, type, id } = args;
  const skip = parseInt(extra.skip || '0');
  const page = Math.floor(skip / 20) + 1;
  const genre = extra.genre;
  
  const provider = id.split('_')[0]; // sunnxt_movies → sunnxt
  
  console.log(`Fetching ${id} page ${page} (provider: ${provider})`);
  
  const metas = await fetchCatalogTamil(type, provider, page, genre);
  
  return {
    meta: metas.slice(skip % 20, (skip % 20) + 20),
    hasMore: metas.length === 20
  };
});

// Define catalogs
builder.defineCatalogs(() => [
  // Movies
  { type: 'movie', id: 'sunnxt_movies', name: 'SunNXT Movies' },
  { type: 'movie', id: 'zee5_movies', name: 'ZEE5 Movies' },
  { type: 'movie', id: 'hotstar_movies', name: 'Disney+ Hotstar Movies' },
  { type: 'movie', id: 'aha_movies', name: 'Aha Movies' },
  { type: 'movie', id: 'sonyliv_movies', name: 'SonyLIV Movies' },
  
  // Series  
  { type: 'series', id: 'sunnxt_series', name: 'SunNXT Series' },
  { type: 'series', id: 'zee5_series', name: 'ZEE5 Series' },
  { type: 'series', id: 'hotstar_series', name: 'Disney+ Hotstar Series' },
  { type: 'series', id: 'aha_series', name: 'Aha Series' },
  { type: 'series', id: 'sonyliv_series', name: 'SonyLIV Series' }
]);

// Meta handler
builder.defineMetaHandler(async (args) => {
  const imdbId = args.id;
  // Simplified - TMDb lookup by IMDb
  return { id: imdbId, name: 'Title from IMDb', type: args.type };
});

module.exports = builder.getInterface();
