async function getMeta(imdbId, type) {
  // If the key is missing or has a typo in the variable name, this returns null
  if (!process.env.TMDB_API_KEY) {
    console.error("TMDB_API_KEY is missing in Render settings");
    return null;
  }

  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${process.env.TMDB_API_KEY}&external_source=imdb_id&language=ta-IN`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Check if TMDB actually returned something
    const results = type === "movie" ? data.movie_results : data.tv_results;
    const r = results && results[0];

    if (!r) return null;

    return {
      id: imdbId,
      type: type,
      name: r.title || r.name,
      poster: `https://image.tmdb.org/t/p/w500${r.poster_path}`,
      background: `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`,
      description: r.overview || "",
      releaseInfo: (r.release_date || r.first_air_date || "").slice(0, 4)
    };
  } catch (e) {
    return null;
  }
}
