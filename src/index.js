const express = require("express");
const cors    = require("cors");
const manifest = require("./manifest");
const { fetchCatalog } = require("./catalog");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Simple in-memory cache (TTL: 30 minutes)
const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 30 * 60 * 1000) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── Routes ───────────────────────────────────────────────────────────────────

// Root redirect → manifest
app.get("/", (req, res) => res.redirect("/manifest.json"));

// Manifest
app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifest);
});

// Catalog handler  →  /catalog/:type/:id.json  (with optional extra props)
app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const extraRaw = req.params.extra || "";

    // Parse Stremio extra props  e.g. "genre=Action&skip=20"
    const extra = {};
    if (extraRaw) {
      extraRaw.split("&").forEach((part) => {
        const [k, v] = part.split("=");
        if (k && v) extra[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }

    // Also accept query string (Nuvio style)
    Object.assign(extra, req.query);

    const cacheKey = `${type}:${id}:${JSON.stringify(extra)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    // Validate catalog exists in manifest
    const catalogDef = manifest.catalogs.find((c) => c.id === id && c.type === type);
    if (!catalogDef) return res.status(404).json({ error: "Catalog not found" });

    const metas = await fetchCatalog(id, type, extra);
    const response = { metas };

    cacheSet(cacheKey, response);
    res.setHeader("Content-Type", "application/json");
    res.json(response);
  } catch (err) {
    console.error("Catalog error:", err.message);
    res.status(500).json({ metas: [] });
  }
});

// Meta handler  →  /meta/:type/:id.json
app.get("/meta/:type/:id.json", async (req, res) => {
  // Delegate to Cinemeta for IMDB IDs — Stremio handles this automatically
  // For tmdb: prefixed IDs, return basic meta
  const { type, id } = req.params;
  if (id.startsWith("tmdb:")) {
    return res.json({ meta: { id, type, name: "Tamil Content" } });
  }
  // For IMDB IDs, return empty so Stremio falls back to Cinemeta
  res.json({ meta: {} });
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", version: manifest.version }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 Tamil OTT Stremio Addon running on port ${PORT}`);
  console.log(`   Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});
