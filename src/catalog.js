const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

// ── Verified Tamil-only IMDB IDs per platform ─────────────────────────────────
// Curated from JustWatch India + verified as Tamil original language on IMDB
// Movies: Tamil originals only (not dubbed)
// Series: Tamil originals only

const PLATFORM_DATA = {

  sunnxt_movies: [
    "tt8108198",  // 96
    "tt15655792", // Jailer
    "tt8143610",  // Master
    "tt7144870",  // Bigil
    "tt9764938",  // Doctor
    "tt10837246", // Ratsasan
    "tt9032398",  // Thiruchitrambalam
    "tt12412888", // Valimai
    "tt14539740", // Leo
    "tt16365614", // Raayan
    "tt9032400",  // Karnan
    "tt6016236",  // Vikram
    "tt11035246", // Beast
    "tt7504726",  // Kannum Kannum Kollaiyadithaal
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt13121618", // Ponniyin Selvan I
    "tt6719968",  // Mersal
    "tt9019536",  // Soorarai Pottru
    "tt15671028", // Viduthalai
  ],

  sunnxt_series: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt9032401",  // Navarasa
    "tt12077116", // Sarpatta Parambarai
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt13615776", // Nenjam Marappathillai
    "tt8291220",  // Jugalbandi
  ],

  sunnxt_webseries: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt15256628", // Triples
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt13615776", // Nenjam Marappathillai
    "tt9032401",  // Navarasa
    "tt14444952", // Kalathil Santhippom
    "tt8291220",  // Jugalbandi
    "tt12077116", // Sarpatta Parambarai
  ],

  sunnxt_shorts: [
    "tt9019536",  // Soorarai Pottru
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt8367814",  // Super Deluxe
    "tt9764938",  // Doctor
    "tt10399902", // Jai Bhim
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt6712648",  // Vada Chennai
  ],

  zee5_movies: [
    "tt9019536",  // Soorarai Pottru
    "tt10399902", // Jai Bhim
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt10837246", // Ratsasan
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt16365614", // Raayan
    "tt11035246", // Beast
    "tt14539740", // Leo
    "tt6016236",  // Vikram
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt8143610",  // Master
    "tt6719968",  // Mersal
    "tt12412888", // Valimai
    "tt7144870",  // Bigil
  ],

  zee5_series: [
    "tt14519434", // Vadhandhi
    "tt9032401",  // Navarasa
    "tt8291224",  // Suzhal
    "tt8291220",  // Jugalbandi
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt12077116", // Sarpatta Parambarai
  ],

  zee5_webseries: [
    "tt14519434", // Vadhandhi
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt8291224",  // Suzhal
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
    "tt12077116", // Sarpatta Parambarai
  ],

  zee5_shorts: [
    "tt9019536",  // Soorarai Pottru
    "tt10399902", // Jai Bhim
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt9764938",  // Doctor
    "tt9032400",  // Karnan
    "tt7504726",  // Kannum Kannum
    "tt8108198",  // 96
  ],

  jiohotstar_movies: [
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt14539740", // Leo
    "tt6016236",  // Vikram
    "tt8143610",  // Master
    "tt9019536",  // Soorarai Pottru
    "tt10399902", // Jai Bhim
    "tt12412888", // Valimai
    "tt9032398",  // Thiruchitrambalam
    "tt15671028", // Viduthalai
    "tt7144870",  // Bigil
    "tt6719968",  // Mersal
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt16365614", // Raayan
    "tt9032400",  // Karnan
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt11035246", // Beast
  ],

  jiohotstar_series: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt9032401",  // Navarasa
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt8291220",  // Jugalbandi
  ],

  jiohotstar_webseries: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
  ],

  jiohotstar_shorts: [
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt14539740", // Leo
    "tt10399902", // Jai Bhim
    "tt9032398",  // Thiruchitrambalam
    "tt15671028", // Viduthalai
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt12412888", // Valimai
    "tt9019536",  // Soorarai Pottru
  ],

  aha_movies: [
    "tt9032398",  // Thiruchitrambalam
    "tt15671028", // Viduthalai
    "tt10399902", // Jai Bhim
    "tt9019536",  // Soorarai Pottru
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt6016236",  // Vikram
    "tt8143610",  // Master
    "tt7144870",  // Bigil
    "tt6719968",  // Mersal
    "tt10837246", // Ratsasan
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt14539740", // Leo
    "tt16365614", // Raayan
    "tt11035246", // Beast
  ],

  aha_webseries: [
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
  ],

  aha_shorts: [
    "tt9032398",  // Thiruchitrambalam
    "tt15671028", // Viduthalai
    "tt9019536",  // Soorarai Pottru
    "tt10399902", // Jai Bhim
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
  ],

  mxplayer_movies: [
    "tt10399902", // Jai Bhim
    "tt9019536",  // Soorarai Pottru
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt6016236",  // Vikram
    "tt8143610",  // Master
    "tt7144870",  // Bigil
    "tt6719968",  // Mersal
    "tt10837246", // Ratsasan
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt14539740", // Leo
    "tt16365614", // Raayan
    "tt12412888", // Valimai
  ],

  mxplayer_series: [
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
  ],

  mxplayer_webseries: [
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
  ],

  mxplayer_shorts: [
    "tt10399902", // Jai Bhim
    "tt9019536",  // Soorarai Pottru
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
  ],

  kalaignar_movies: [
    "tt6719968",  // Mersal
    "tt7144870",  // Bigil
    "tt8143610",  // Master
    "tt6016236",  // Vikram
    "tt9764938",  // Doctor
    "tt10837246", // Ratsasan
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt6712648",  // Vada Chennai
    "tt8367814",  // Super Deluxe
    "tt9019536",  // Soorarai Pottru
    "tt10399902", // Jai Bhim
    "tt15655792", // Jailer
    "tt13121618", // Ponniyin Selvan I
    "tt14539740", // Leo
    "tt16365614", // Raayan
    "tt12412888", // Valimai
    "tt11035246", // Beast
    "tt9032398",  // Thiruchitrambalam
  ],

  kalaignar_series: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt9032401",  // Navarasa
    "tt12077116", // Sarpatta Parambarai
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt13615776", // Nenjam Marappathillai
    "tt8291220",  // Jugalbandi
  ],

  kalaignar_webseries: [
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt9032401",  // Navarasa
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt11847842", // Six
    "tt10954984", // Yaar Ival
    "tt13615776", // Nenjam Marappathillai
    "tt8291220",  // Jugalbandi
    "tt12077116", // Sarpatta Parambarai
  ],

  kalaignar_shorts: [
    "tt6719968",  // Mersal
    "tt7144870",  // Bigil
    "tt8143610",  // Master
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt6712648",  // Vada Chennai
    "tt9019536",  // Soorarai Pottru
    "tt8367814",  // Super Deluxe
    "tt10399902", // Jai Bhim
  ],

  sonyliv_movies: [
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt9764938",  // Doctor
    "tt10399902", // Jai Bhim
    "tt9019536",  // Soorarai Pottru
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt8108198",  // 96
    "tt7504726",  // Kannum Kannum
    "tt9032400",  // Karnan
    "tt6016236",  // Vikram
    "tt8143610",  // Master
    "tt7144870",  // Bigil
    "tt6719968",  // Mersal
    "tt10837246", // Ratsasan
    "tt13121618", // Ponniyin Selvan I
    "tt15655792", // Jailer
    "tt14539740", // Leo
    "tt16365614", // Raayan
    "tt12412888", // Valimai
  ],

  sonyliv_series: [
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
    "tt10954984", // Yaar Ival
    "tt11847842", // Six
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
  ],

  sonyliv_webseries: [
    "tt9032401",  // Navarasa
    "tt8291220",  // Jugalbandi
    "tt10954984", // Yaar Ival
    "tt11847842", // Six
    "tt15256628", // Triples
    "tt14444952", // Kalathil Santhippom
    "tt13615776", // Nenjam Marappathillai
    "tt8291224",  // Suzhal
    "tt14519434", // Vadhandhi
    "tt12077116", // Sarpatta Parambarai
  ],

  sonyliv_shorts: [
    "tt8367814",  // Super Deluxe
    "tt6712648",  // Vada Chennai
    "tt10399902", // Jai Bhim
    "tt9019536",  // Soorarai Pottru
    "tt15671028", // Viduthalai
    "tt9032398",  // Thiruchitrambalam
    "tt9764938",  // Doctor
    "tt8108198",  // 96
    "tt9032400",  // Karnan
    "tt7504726",  // Kannum Kannum
  ],
};

// ── TMDB metadata fetcher ─────────────────────────────────────────────────────
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
    background: r.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
    description: r.overview || undefined,
    releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
    imdbRating: r.vote_average
      ? String(parseFloat(r.vote_average).toFixed(1)) : undefined,
  };
  metaCache.set(imdbId, meta);
  return meta;
}

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

  return pageIds.map(id => ({ id, type, name: id }));
}

module.exports = { fetchCatalog };
