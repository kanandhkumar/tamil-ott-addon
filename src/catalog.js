const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_KEY = process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE";

const CATALOG_DATA = {
  tamil_movies: [
    { title: "Jailer", type: "movie" },
    { title: "Leo", type: "movie" },
    { title: "Vikram", type: "movie" },
    { title: "Viduthalai Part 1", type: "movie" },
    { title: "Soorarai Pottru", type: "movie" },
    { title: "Parking", type: "movie" },
    { title: "Dada", type: "movie" }
  ],
  tamil_series: [
    { title: "Ayali", type: "series" },
    { title: "Vilangu", type: "series" },
    { title: "Pettaikaali", type: "series" },
    { title: "Sengalam", type: "series" },
    { title: "Vadhandhi", type: "series" }
  ]
};

async function searchTMDB(title, type) {
  try {
    const endpoint = type === "movie" ? "search/movie" : "search/tv";
    const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || !data.results.length) return null;

    const r = data.results[0];

    return {
      id: `tmdb:${type}:${r.id}`,
      type: type === "series" ? "series" : "movie",
      name: r.title || r.name || title,
      poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
      description: r.overview || "",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) {
    return null;
  }
}

async function fetchCatalog(catalogId, type, extra = {}) {
  const items = CATALOG_DATA[catalogId] || [];
  const skip = parseInt(extra.skip || 0, 10);
  const pageItems = items.slice(skip, skip + 20);

  const metas = await Promise.all(
    pageItems.map(item => searchTMDB(item.title, item.type))
  );

  return metas.filter(Boolean);
}

module.exports = { fetchCatalog };
