const fetch = require("node-fetch");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// Use Gemini 1.5 Flash with Google Search grounding
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const geminiCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const PLATFORM_NAMES = {
  sunnxt:     "Sun NXT",
  zee5:       "ZEE5",
  jiohotstar: "JioHotstar",
  aha:        "Aha Tamil",
  mxplayer:   "Amazon MX Player",
  kalaignar:  "Kalaignar TV",
  sonyliv:    "Sony LIV",
};

const CONTENT_TYPES = {
  movies:    "Tamil movies",
  series:    "Tamil TV shows",
  webseries: "Tamil web series and originals",
  shorts:    "Tamil short films",
};

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null;

  const cacheKey = `${platform}_${subtype}`;
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const platformName = PLATFORM_NAMES[platform] || platform;
  const contentType  = CONTENT_TYPES[subtype] || "Tamil content";
  const year = new Date().getFullYear();

  const prompt = `Search the web and find ${contentType} released in ${year-1} or ${year} that are available on ${platformName} India.

Rules:
- Only Tamil ORIGINAL language content (not dubbed into Tamil)
- Must be actually available on ${platformName} in India right now
- Return their IMDB IDs only

Search for: "site:imdb.com Tamil ${contentType} ${platformName} ${year}"
Also search: "${platformName} Tamil ${contentType} ${year} IMDB"

Return ONLY a JSON array of valid IMDB IDs (format tt followed by 7-8 digits).
Return at least 10 IDs, maximum 20.
Example: ["tt6016236","tt15655792","tt8143610"]

IMPORTANT: Only return tt IDs you are 100% certain are Tamil original language films. Do not guess.`;

  try {
    console.log(`[Gemini] Searching web for ${platformName} ${subtype} ${year}...`);
    
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        },
        tools: [{
          googleSearch: {}
        }],
      }),
      timeout: 20000,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini] API error ${res.status}: ${errText.slice(0,200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[Gemini] Raw: ${text.slice(0, 300)}`);

    // Extract JSON array
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      console.error(`[Gemini] No JSON array in response`);
      return null;
    }

    let ids;
    try {
      ids = JSON.parse(match[0]);
    } catch {
      console.error(`[Gemini] JSON parse failed`);
      return null;
    }

    if (!Array.isArray(ids) || ids.length === 0) return null;

    // Validate IMDB format strictly
    const valid = ids.filter(id => typeof id === "string" && /^tt\d{7,8}$/.test(id));
    console.log(`[Gemini] ${valid.length} valid IDs for ${cacheKey}: ${valid.join(",")}`);

    if (valid.length < 5) {
      console.error(`[Gemini] Too few valid IDs (${valid.length})`);
      return null;
    }

    geminiCache.set(cacheKey, { data: valid, ts: Date.now() });
    return valid;

  } catch (err) {
    console.error(`[Gemini] Error: ${err.message}`);
    return null;
  }
}

module.exports = { askGemini };
