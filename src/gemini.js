const fetch = require("node-fetch");

// This is safe. It pulls from Render's secret environment.
const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const geminiCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

const PLATFORM_NAMES = {
  sunnxt: "Sun NXT", zee5: "ZEE5", jiohotstar: "JioHotstar", 
  aha: "Aha Tamil", sonyliv: "Sony LIV", netflix: "Netflix", prime: "Amazon Prime Video"
};

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null; // Safety check

  const cacheKey = `${platform}_${subtype}`;
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const platformName = PLATFORM_NAMES[platform] || platform;
  const year = new Date().getFullYear();

  const prompt = `Return a JSON array of IMDB IDs (ttXXXXXXX) for Tamil language ${subtype} currently available on ${platformName} India released in ${year} or ${year-1}. 
  IMPORTANT: Only return original Tamil movies/shows. No dubbed content. 
  Example format: ["tt30141680", "tt17057710"]`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      })
    });

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;

    const ids = JSON.parse(match[0]).filter(id => /^tt\d+/.test(id));
    geminiCache.set(cacheKey, { data: ids, ts: Date.now() });
    return ids;
  } catch (e) { return null; }
}

module.exports = { askGemini };
