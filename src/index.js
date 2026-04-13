const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { getProviderCatalog } = require("./providers/justwatch");
const { getMetaFromImdb } = require("./providers/tmdb");

const manifest = {
  id: "com.kanand.tamilott",
  version: "1.0.0",
  name: "Tamil OTT",
  description: "Tamil OTT catalogs using provider mapping + TMDb metadata",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  catalogs: [
    { type: "movie", id: "sunnxt_movies", name: "SunNXT Movies" },
    { type: "movie", id: "zee5_movies", name: "ZEE5 Movies" },
    { type: "movie", id: "jiohotstar_movies", name: "JioHotstar Movies" },
    { type: "movie", id: "sonyliv_movies", name: "SonyLIV Movies" },
    { type: "series", id: "aha_series", name: "Aha Tamil Series" }
  ]
};

const builder = new addonBuilder(manifest);
const metaCache = new Map();

async function getCachedMeta(imdbId, type) {
  const key = `${type}:${imdbId}`;
  if (metaCache.has(key)) return metaCache.get(key);

  const meta = await getMetaFromImdb(imdbId, type);
  if (meta) metaCache.set(key, meta);
  return meta;
}

builder.defineCatalogHandler(async ({ id, extra }) => {
  const skip = parseInt((extra && extra.skip) || 0, 10);
  const rows = await getProviderCatalog(id);
  const selected = rows.slice(skip, skip + 20);

  const metas = await Promise.all(
    selected.map(row => getCachedMeta(row.imdbId, row.type))
  );

  return { metas: metas.filter(Boolean) };
});

builder.defineMetaHandler(async ({ id, type }) => {
  const meta = await getCachedMeta(id, type);
  return { meta: meta || null };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
