const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY  = process.env.TMDB_API_KEY || "";

const GENRE_MAP = {
  Action:28, Drama:18, Comedy:35, Thriller:53, Romance:10749,
  Horror:27, Family:10751, "Sci-Fi":878, Animation:16, Crime:80,
  Reality:10764, News:10763, Devotional:null,
};

const PROVIDER_IDS = {
  sunnxt:237, zee5:232, hotstar:122, aha:532,
  mxplayer:515, kalaignar:null, sonyliv:11,
};

const CURATED = {
  kalaignar_movies:  ["tt3263904","tt6016236","tt8143610","tt7144870","tt9019536","tt8108198","tt9032400","tt7504726","tt6719968","tt5078116"],
  kalaignar_series:  ["tt7144870","tt9019536","tt8143610","tt6016236","tt7504726"],
  kalaignar_webseries:["tt9032400","tt8108198","tt6719968","tt5078116","tt7144870"],
  kalaignar_shorts:  ["tt6016236","tt7144870","tt9019536","tt8143610","tt7504726"],
};

const TAMIL_MOVIES_SEED = [
  { id:"tt6016236",  name:"Vikram",               poster:"https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg", year:2022, genres:["Action","Thriller"] },
  { id:"tt8143610",  name:"Master",               poster:"https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg", year:2021, genres:["Action","Drama"] },
  { id:"tt7144870",  name:"Bigil",                poster:"https://image.tmdb.org/t/p/w500/5VEJlv5OQw5rlWbfUgNW9j18xwM.jpg", year:2019, genres:["Action","Drama"] },
  { id:"tt9019536",  name:"Soorarai Pottru",      poster:"https://image.tmdb.org/t/p/w500/xBDGHXHpBJ8OPnCGGOILqbVxVOi.jpg", year:2020, genres:["Drama"] },
  { id:"tt8108198",  name:"96",                   poster:"https://image.tmdb.org/t/p/w500/4IXi9UqCcuJJI7CXC7r0T7USTpL.jpg", year:2018, genres:["Drama","Romance"] },
  { id:"tt6719968",  name:"Mersal",               poster:"https://image.tmdb.org/t/p/w500/3nHDnE0OAT6dAOCqKUVSVBn4Dw8.jpg", year:2017, genres:["Action","Thriller"] },
  { id:"tt5078116",  name:"Baahubali 2",          poster:"https://image.tmdb.org/t/p/w500/qngoNhLXORQH9nVjYS6kNTHGXg.jpg",  year:2017, genres:["Action","Drama"] },
  { id:"tt7504726",  name:"Kannum Kannum Kollaiyadithaal", poster:"https://image.tmdb.org/t/p/w500/beFBVFZaGSSjDaG7OGrYxKhp6kJ.jpg", year:2020, genres:["Romance","Thriller"] },
  { id:"tt9032400",  name:"Karnan",               poster:"https://image.tmdb.org/t/p/w500/5C5KnbHX4XNJCMvpMQKIBLYM0Xy.jpg", year:2021, genres:["Action","Drama"] },
  { id:"tt3263904",  name:"Kaala",                poster:"https://image.tmdb.org/t/p/w500/bdqXyOl1K5RxsQYHG1BaCb3Bgzz.jpg", year:2018, genres:["Action","Drama"] },
  { id:"tt10399902", name:"Jai Bhim",             poster:"https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg", year:2021, genres:["Drama","Crime"] },
  { id:"tt8367814",  name:"Super Deluxe",         poster:"https://image.tmdb.org/t/p/w500/7MVHvMCuLzSIhkELrxbXzLmgF0A.jpg", year:2019, genres:["Drama","Thriller"] },
  { id:"tt6712648",  name:"Vada Chennai",         poster:"https://image.tmdb.org/t/p/w500/wDYnzJC8KmkqCHCTiiqfXPqMQmQ.jpg", year:2018, genres:["Action","Crime"] },
  { id:"tt9764938",  name:"Doctor",               poster:"https://image.tmdb.org/t/p/w500/g9uwnJNQDtUAH7kPxwDIDgOvyEl.jpg", year:2021, genres:["Action","Thriller"] },
  { id:"tt13121618", name:"Ponniyin Selvan: I",   poster:"https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg", year:2022, genres:["Action","Drama"] },
  { id:"tt15655792", name:"Jailer",               poster:"https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg", year:2023, genres:["Action","Drama"] },
  { id:"tt14539740", name:"Leo",                  poster:"https://image.tmdb.org/t/p/w500/jTiDY0tkMBkTHiJRXj9HaA8dBX1.jpg", year:2023, genres:["Action","Thriller"] },
  { id:"tt9032398",  name:"Thiruchitrambalam",    poster:"https://image.tmdb.org/t/p/w500/zqFvd15pRhTrmrXLVQ5R6T5x4CW.jpg", year:2022, genres:["Drama","Romance"] },
  { id:"tt15671028", name:"Viduthalai",           poster:"https://image.tmdb.org/t/p/w500/2eMGd1KFXHF0lGmyMfNHAe8Zyze.jpg", year:2023, genres:["Drama","Thriller"] },
  { id:"tt12412888", name:"Valimai",              poster:"https://image.tmdb.org/t/p/w500/3kcvGzfFHEhGpbwSuGScaEYqCim.jpg", year:2022, genres:["Action"] },
];

const TAMIL_SERIES_SEED = [
  { id:"tt8291224",  name:"Suzhal – The Vortex",  poster:"https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg", year:2022, genres:["Crime","Thriller"] },
  { id:"tt14519434", name:"Vadhandhi",            poster:"https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg", year:2022, genres:["Crime","Mystery"] },
  { id:"tt12077116", name:"Sarpatta Parambarai",  poster:"https://image.tmdb.org/t/p/w500/1YECzmM9UepSmA8drIXFRNTxYMJ.jpg", year:2021, genres:["Action","Drama"] },
  { id:"tt9032401",  name:"Navarasa",             poster:"https://image.tmdb.org/t/p/w500/2oCqDJ2JXfKVVqXdDr2A6wRKfQ7.jpg", year:2021, genres:["Drama"] },
  { id:"tt8291220",  name:"Jugalbandi",           poster:"https://image.tmdb.org/t/p/w500/4IXi9UqCcuJJI7CXC7r0T7USTpL.jpg", year:2022, genres:["Drama","Comedy"] },
];

async function tmdbGet(path, params={}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language","ta-IN");
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  try {
    const res = await fetch(url.toString(), {timeout:8000});
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function tmdbToMeta(item, type) {
  if (!item) return null;
  const imdb = item.imdb_id ? item.imdb_id : `tmdb:${item.id}`;
  const poster = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;
  if (!poster) return null;
  return {
    id: imdb, type,
    name: item.title || item.name || "Unknown",
    poster,
    background: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
    description: item.overview || undefined,
    releaseInfo: (item.release_date||item.first_air_date||"").slice(0,4) || undefined,
    genres: (item.genres||[]).map(g=>typeof g==="object"?g.name:String(g)).filter(Boolean),
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
  };
}

async function fetchCatalog(catalogId, type, extra={}) {
  const skip   = parseInt(extra.skip||0);
  const page   = Math.floor(skip/20)+1;
  const genre  = extra.genre||null;
  const search = extra.search||null;
  const platform = catalogId.split("_")[0];

  if (CURATED[catalogId]) {
    const ids = CURATED[catalogId];
    return ids.map(id=>{
      const s = TAMIL_MOVIES_SEED.find(m=>m.id===id)||TAMIL_SERIES_SEED.find(m=>m.id===id);
      if (!s) return null;
      return { id:s.id, type, name:s.name, poster:s.poster, releaseInfo:String(s.year), genres:s.genres };
    }).filter(Boolean).slice(skip, skip+20);
  }

  if (search && TMDB_KEY) {
    const mt = type==="movie"?"movie":"tv";
    const data = await tmdbGet(`/search/${mt}`,{query:search,page,with_original_language:"ta"});
    if (!data) return seedFallback(type,skip,genre);
    const results = await Promise.all(
      (data.results||[]).filter(r=>r.original_language==="ta").slice(0,20).map(async r=>{
        const d = await tmdbGet(`/${mt}/${r.id}`,{append_to_response:"external_ids"});
        if (!d) return null;
        if (d.external_ids) d.imdb_id=d.external_ids.imdb_id;
        return tmdbToMeta(d,type);
      })
    );
    return results.filter(Boolean);
  }

  if (TMDB_KEY) {
    const pid = PROVIDER_IDS[platform];
    if (pid) {
      const mt = type==="movie"?"movie":"tv";
      const params = { page, with_original_language:"ta", with_watch_providers:pid, watch_region:"IN", sort_by:"popularity.desc" };
      if (genre && GENRE_MAP[genre]) params.with_genres=GENRE_MAP[genre];
      const data = await tmdbGet(`/discover/${mt}`,params);
      if (data&&data.results&&data.results.length>0) {
        const results = await Promise.all(
          data.results.slice(0,20).map(async r=>{
            const d = await tmdbGet(`/${mt}/${r.id}`,{append_to_response:"external_ids"});
            if (!d) return null;
            if (d.external_ids) d.imdb_id=d.external_ids.imdb_id;
            return tmdbToMeta(d,type);
          })
        );
        return results.filter(Boolean);
      }
    }
  }

  return seedFallback(type,skip,genre);
}

function seedFallback(type,skip=0,genre=null) {
  let pool = type==="movie"?TAMIL_MOVIES_SEED:TAMIL_SERIES_SEED;
  if (genre) pool=pool.filter(m=>m.genres.includes(genre));
  return pool.slice(skip,skip+20).map(m=>({
    id:m.id, type, name:m.name, poster:m.poster,
    releaseInfo:String(m.year), genres:m.genres,
  }));
}

module.exports = { fetchCatalog };
