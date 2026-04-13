const fetch = require("node-fetch");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// Cache Gemini results for 12 hours
const geminiCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

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
  series:    "Tamil TV shows and serials",
  webseries: "Tamil web series and originals",
  shorts:    "Tamil short films and mini series",
};

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null;

  const cacheKey = `${platform}_${subtype}`;
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.log(`[Gemini] Cache hit: ${cacheKey}`);
    return cached.data;
  }

  const platformName = PLATFORM_NAMES[platform] || platform;
  const contentType  = CONTENT_TYPES[subtype] || "Tamil content";

  const prompt = `You are a Tamil cinema expert with up-to-date knowledge of Indian OTT platforms.

List exactly 20 ${contentType} available on ${platformName} in India as of 2025-2026.
Only include original Tamil language content (not dubbed).
Return ONLY a valid JSON array of IMDB IDs, nothing else.
Example format: ["tt1234567","tt2345678","tt3456789"]

Requirements:
- All must be Tamil original language (not Hindi/Telugu/Malayalam dubbed in Tamil)
- All must be currently available or have been available on ${platformName} India
- Mix of recent (2020-2026) and popular classic titles
- No duplicates
- Valid IMDB IDs only (format: tt followed by 7-8 digits)`;

  try {
    console.log(`[Gemini] Querying for ${platformName} ${subtype}...`);
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        },
      }),
      timeout: 15000,
    });

    if (!res.ok) {
      console.error(`[Gemini] API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[Gemini] Raw response for ${cacheKey}: ${text.slice(0, 100)}...`);

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      console.error(`[Gemini] No JSON array found in response`);
      return null;
    }

    const ids = JSON.parse(match[0]);
    if (!Array.isArray(ids) || ids.length === 0) return null;

    // Validate IMDB ID format
    const valid = ids.filter(id => /^tt\d{7,8}$/.test(id));
    console.log(`[Gemini] Got ${valid.length} valid IDs for ${cacheKey}`);

    if (valid.length < 5) return null; // Too few valid IDs

    geminiCache.set(cacheKey, { data: valid, ts: Date.now() });
    return valid;

  } catch (err) {
    console.error(`[Gemini] Error: ${err.message}`);
    return null;
  }
}

module.exports = { askGemini };
