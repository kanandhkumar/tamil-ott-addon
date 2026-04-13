const manifest = {
  id: "com.kanandhkumar.tamilott",
  name: "Tamil OTT Catalog",
  version: "1.4.0",
  description: "Tamil Movies and Series (AI Powered)",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { id: "netflix_tamil", type: "movie", name: "Netflix - Tamil" },
    { id: "prime_tamil", type: "movie", name: "Prime - Tamil" },
    { id: "sunnxt_movies", type: "movie", name: "SunNXT - Movies" },
    { id: "aha_movies", type: "movie", name: "Aha Tamil - Movies" },
    { id: "zee5_movies", type: "movie", name: "ZEE5 - Tamil" },
    { id: "jiohotstar_movies", type: "movie", name: "JioHotstar - Tamil" },
    { id: "sunnxt_series", type: "series", name: "SunNXT - Series" },
    { id: "aha_webseries", type: "series", name: "Aha Tamil - Series" }
  ],
  idPrefixes: ["tt"]
};
module.exports = manifest;
