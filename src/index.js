const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { fetchCatalog } = require("./catalog");

const manifest = {
  id: "com.kanand.tamilott",
  version: "1.0.0",
  name: "Tamil OTT",
  description: "Tamil movie and series catalog",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "tamil_movies", name: "Tamil Movies" },
    { type: "series", id: "tamil_series", name: "Tamil Series" }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  const metas = await fetchCatalog(id, type, extra || {});
  return { metas };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
