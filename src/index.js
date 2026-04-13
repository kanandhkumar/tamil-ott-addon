const express = require("express");
const cors = require("cors");
const manifest = require("./manifest");
const { fetchCatalog } = require("./catalog");

const app = express();
app.use(cors());

// Manifest route
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

// Catalog route
app.get("/catalog/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;
  const extra = {
    skip: req.query.skip || 0,
    search: req.query.search
  };

  try {
    const metas = await fetchCatalog(id, type, extra);
    res.json({ metas });
  } catch (err) {
    console.error("Catalog Error:", err);
    res.json({ metas: [] });
  }
});

// For Render.com deployment
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Addon active at http://localhost:${port}/manifest.json`);
});
