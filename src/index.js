// 2. Cinemeta Fetcher (Updated to capture all fields)
async function getMeta(imdbId, type) {
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`);
    const data = await res.json();
    
    // Check if data exists and get the 'meta' object
    const meta = data.meta;
    if (!meta) return null;

    return {
      id: imdbId,
      type: type,
      name: meta.name || "Unknown Title",
      poster: meta.poster || "",
      background: meta.background || "",
      description: meta.description || "",
      releaseInfo: meta.year || meta.releaseInfo || ""
    };
  } catch (e) {
    console.error("Cinemeta Error for " + imdbId, e);
    return null;
  }
}

// 3. Updated Catalog Route
app.get("/catalog/:type/:id.json", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const type = req.params.type;
  const platform = req.params.id.split("_")[0].toLowerCase();
  
  const FALLBACK = {
    netflix: ["tt30141680"], 
    prime: ["tt31281232"],   
    sunnxt: ["tt17057710"],  
    aha: ["tt13647612"]      
  };

  let ids = await askGemini(platform, type);
  if (!ids || ids.length === 0) ids = FALLBACK[platform] || ["tt30141680"];

  // Force it to wait for all meta data to be fetched
  const metas = [];
  for (const id of ids) {
    const m = await getMeta(id, type);
    if (m) metas.push(m);
  }

  res.json({ metas });
});
