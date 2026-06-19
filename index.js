// Licensed Indian OTT Catalog + Deep-Link Stremio Addon
// Catalogs movies/shows available on JioHotstar, ZEE5 and Sun NXT (via TMDB watch-provider
// data) and, instead of streaming pirated files, gives you a "stream" entry that opens the
// title's page on the official platform's website (which hands off to the app if installed).
//
// IMPORTANT LIMITATION: TMDB does not expose each platform's internal content ID, so we can't
// build an exact "play this exact title" deep link. Instead each entry opens a search page on
// the platform for that title - reliable, but one extra tap inside the app/site.

const express = require("express");
const app = express();

const TMDB_API_KEY = process.env.TMDB_API_KEY; // v3 API key (not the Bearer/v4 token)
const TMDB_BASE = "https://api.themoviedb.org/3";
const REGION = "IN";

// Only titles in this original language are surfaced. Set to null to show all languages
// available on these platforms.
const LANGUAGE_FILTER = "ta"; // Tamil, to match the rest of Anandh's Tamil OTT setup

// Names as they appear in TMDB's provider list. We resolve real provider_ids at startup
// instead of hardcoding them, since TMDB's IDs aren't documented anywhere reliable.
const TARGET_PROVIDERS = [
  { key: "jiohotstar", matchNames: ["jiohotstar", "disney+ hotstar", "hotstar"], searchUrl: (q) => `https://www.hotstar.com/in/search?q=${encodeURIComponent(q)}` },
  { key: "zee5", matchNames: ["zee5"], searchUrl: (q) => `https://www.zee5.com/search?q=${encodeURIComponent(q)}` },
  { key: "sunnxt", matchNames: ["sun nxt", "sunnxt"], searchUrl: (q) => `https://www.sunnxt.com/search/${encodeURIComponent(q)}` },
];

let providerIdCache = null; // { movie: {jiohotstar: 123, zee5: 232, sunnxt: 236}, tv: {...} }

async function tmdbFetch(path, params = {}) {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY env var is not set");
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
  return res.json();
}

function matchProvider(providerName, target) {
  const n = providerName.toLowerCase();
  return target.matchNames.some((m) => n.includes(m));
}

async function resolveProviderIds() {
  if (providerIdCache) return providerIdCache;
  const result = { movie: {}, tv: {} };
  for (const mediaType of ["movie", "tv"]) {
    const data = await tmdbFetch(`/watch/providers/${mediaType}`, { watch_region: REGION });
    for (const target of TARGET_PROVIDERS) {
      const found = (data.results || []).find((p) => matchProvider(p.provider_name, target));
      if (found) result[mediaType][target.key] = found.provider_id;
    }
  }
  providerIdCache = result;
  console.log("Resolved provider IDs:", JSON.stringify(result));
  return result;
}

function tmdbItemToMeta(item, mediaType) {
  const isMovie = mediaType === "movie";
  return {
    id: `tmdb:${mediaType}:${item.id}`,
    type: isMovie ? "movie" : "series",
    name: isMovie ? item.title : item.name,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
    background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
    description: item.overview,
    releaseInfo: (isMovie ? item.release_date : item.first_air_date || "").slice(0, 4),
    imdbRating: item.vote_average ? String(Math.round(item.vote_average * 10) / 10) : undefined,
  };
}

const manifest = {
  id: "org.anandh.licensedottdeeplink",
  version: "1.0.0",
  name: "Licensed Indian OTT (Deep Link)",
  description: "Browse Tamil titles on JioHotstar, ZEE5 and Sun NXT, and open them straight in the official app/site.",
  logo: "https://image.tmdb.org/t/p/w200/wwemzKWzjKYJFfCeiB57q3r4Bcm.png",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["tmdb:"],
  catalogs: [
    { type: "movie", id: "jiohotstar-ta-movies", name: "JioHotstar Tamil Movies" },
    { type: "movie", id: "zee5-ta-movies", name: "ZEE5 Tamil Movies" },
    { type: "movie", id: "sunnxt-ta-movies", name: "Sun NXT Tamil Movies" },
    { type: "series", id: "jiohotstar-ta-series", name: "JioHotstar Tamil Series" },
    { type: "series", id: "zee5-ta-series", name: "ZEE5 Tamil Series" },
    { type: "series", id: "sunnxt-ta-series", name: "Sun NXT Tamil Series" },
  ],
};

const CATALOG_MAP = {
  "jiohotstar-ta-movies": { providerKey: "jiohotstar", mediaType: "movie" },
  "zee5-ta-movies": { providerKey: "zee5", mediaType: "movie" },
  "sunnxt-ta-movies": { providerKey: "sunnxt", mediaType: "movie" },
  "jiohotstar-ta-series": { providerKey: "jiohotstar", mediaType: "tv" },
  "zee5-ta-series": { providerKey: "zee5", mediaType: "tv" },
  "sunnxt-ta-series": { providerKey: "sunnxt", mediaType: "tv" },
};

app.get("/manifest.json", (req, res) => res.json(manifest));

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const { id } = req.params;
    const config = CATALOG_MAP[id];
    if (!config) return res.json({ metas: [] });

    const ids = await resolveProviderIds();
    const providerId = ids[config.mediaType][config.providerKey];
    if (!providerId) return res.json({ metas: [] });

    let page = 1;
    if (req.params.extra) {
      const match = decodeURIComponent(req.params.extra).match(/skip=(\d+)/);
      if (match) page = Math.floor(parseInt(match[1], 10) / 20) + 1;
    }

    const data = await tmdbFetch(`/discover/${config.mediaType}`, {
      watch_region: REGION,
      with_watch_providers: providerId,
      with_original_language: LANGUAGE_FILTER || undefined,
      sort_by: "popularity.desc",
      page,
    });

    const metas = (data.results || []).map((item) => tmdbItemToMeta(item, config.mediaType));
    res.json({ metas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ metas: [], error: err.message });
  }
});

app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const [, mediaType, tmdbId] = req.params.id.split(":");
    const data = await tmdbFetch(`/${mediaType}/${tmdbId}`, {});
    res.json({ meta: tmdbItemToMeta(data, mediaType) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const [, mediaType, tmdbId] = req.params.id.split(":");
    const [detail, providersResp] = await Promise.all([
      tmdbFetch(`/${mediaType}/${tmdbId}`, {}),
      tmdbFetch(`/${mediaType}/${tmdbId}/watch/providers`, {}),
    ]);

    const title = mediaType === "movie" ? detail.title : detail.name;
    const regionProviders = (providersResp.results && providersResp.results[REGION]) || {};
    const available = [
      ...(regionProviders.flatrate || []),
      ...(regionProviders.ads || []),
      ...(regionProviders.free || []),
    ];

    const streams = [];
    for (const target of TARGET_PROVIDERS) {
      const onThisProvider = available.some((p) => matchProvider(p.provider_name, target));
      if (onThisProvider) {
        streams.push({
          name: target.key,
          title: `Open in ${target.key === "jiohotstar" ? "JioHotstar" : target.key === "zee5" ? "ZEE5" : "Sun NXT"}`,
          externalUrl: target.searchUrl(title),
        });
      }
    }

    res.json({ streams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ streams: [], error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send('Licensed Indian OTT Deep-Link Addon is running. Install via <a href="/manifest.json">manifest.json</a>.');
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Addon listening on port ${PORT}`));