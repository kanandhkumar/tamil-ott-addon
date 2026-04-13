module.exports = {
  id: "com.kanand.tamilott.v2",
  version: "1.0.1",
  name: "Tamil OTT",
  description: "Tamil movie and series catalog",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "tamil_movies", name: "Tamil Movies" },
    { type: "series", id: "tamil_series", name: "Tamil Series" }
  ]
};
