const express = require("express");
const cors    = require("cors");
const manifest = require("./manifest");
const { fetchCatalog } = require("./catalog");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 30 * 60 * 1000) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) { cache.set(key, { data, ts: Date.now() }); }

app.get("/", (req, res) => res.redirect("/manifest.json"));

app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifest);
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  try {
    const { type, id } = req.params;
    const extraRaw = req.params.extra || "";
    const extra = {};
    if (extraRaw) {
      extraRaw.split("&").forEach((part) => {
        const [k, v] = part.split("=");
        if (k && v) extra[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }
    Object.assign(extra, req.query);
    const cacheKey = `${type}:${id}:${JSON.stringify(extra)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
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

app.get("/meta/:type/:id.json", async (req, res) => {
  res.json({ meta: {} });
});

app.get("/health", (req, res) => res.json({ status: "ok", version: manifest.version }));

app.listen(PORT, () => {
  console.log(`Tamil OTT Addon running on port ${PORT}`);
});
