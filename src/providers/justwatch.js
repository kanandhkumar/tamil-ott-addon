// Start with a curated verified seed list per provider.
// Later you can replace this with live JustWatch scraping/search results.

const PROVIDER_CATALOGS = {
  sunnxt_movies: [
    { imdbId: "tt6016236", type: "movie" },   // Vikram
    { imdbId: "tt15655792", type: "movie" },  // Jailer
    { imdbId: "tt14539740", type: "movie" }   // Leo
  ],
  zee5_movies: [
    { imdbId: "tt8143610", type: "movie" },   // Master
    { imdbId: "tt7144870", type: "movie" },   // Bigil
    { imdbId: "tt10399902", type: "movie" }   // Jai Bhim
  ],
  jiohotstar_movies: [
    { imdbId: "tt13121618", type: "movie" },  // Ponniyin Selvan I
    { imdbId: "tt14519434", type: "series" }, // placeholder if needed elsewhere
    { imdbId: "tt8291224", type: "series" }   // Suzhal
  ],
  sonyliv_movies: [
    { imdbId: "tt15671028", type: "movie" },  // Viduthalai
    { imdbId: "tt9019536", type: "movie" }    // Soorarai Pottru
  ],
  aha_series: [
    { imdbId: "tt8291224", type: "series" },  // Suzhal
    { imdbId: "tt14519434", type: "series" }, // Vadhandhi
    { imdbId: "tt9032401", type: "series" }   // Navarasa
  ]
};

async function getProviderCatalog(catalogId) {
  return PROVIDER_CATALOGS[catalogId] || [];
}

module.exports = { getProviderCatalog };
