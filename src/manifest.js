const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.0.0",
  description: "Tamil Movies and Series by Platform",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { id: "netflix_tamil", type: "movie", name: "Netflix India - Tamil" },
    { id: "prime_tamil", type: "movie", name: "Prime Video - Tamil" },
    { id: "jiohotstar_movies", type: "movie", name: "JioHotstar - Tamil" },
    { id: "sunnxt_movies", type: "movie", name: "SunNXT - Tamil" },
    { id: "aha_movies", type: "movie", name: "Aha Tamil - Movies" },
    { id: "zee5_movies", type: "movie", name: "ZEE5 - Tamil" },
    { id: "sonyliv_movies", type: "movie", name: "SonyLIV - Tamil" },
    { id: "sunnxt_series", type: "series", name: "SunNXT - Series" },
    { id: "aha_webseries", type: "series", name: "Aha Tamil - Series" }
  ],
  idPrefixes: ["tt"]
};
module.exports = manifest;
