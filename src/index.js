const express = require("express");
const cors = require("cors");
const manifest = require("./manifest");
const { fetchCatalog } = require("./catalog");

const app = express();
app.use(cors());

app.get("/manifest.json", (req, res) => res.json(manifest));

app.get("/catalog/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;
  try {
    const metas = await fetchCatalog(id, type, { skip: req.query.skip || 0 });
    res.json({ metas });
  } catch (err) {
    res.json({ metas: [] });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server running on port ${port}`));
