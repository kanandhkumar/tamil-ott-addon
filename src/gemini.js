const fetch = require("node-fetch");

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const geminiCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

// Known good Tamil IMDB IDs that Gemini can pick from
// These are 100% verified Tamil original language films
const VERIFIED_TAMIL_MOVIES = {
  "tt6016236": "Vikram",
  "tt15655792": "Jailer",
  "tt14539740": "Leo",
  "tt13121618": "Ponniyin Selvan I",
  "tt8143610": "Master",
  "tt7144870": "Bigil",
  "tt10399902": "Jai Bhim",
  "tt9019536": "Soorarai Pottru",
  "tt8367814": "Super Deluxe",
  "tt6712648": "Vada Chennai",
  "tt9764938": "Doctor",
  "tt8108198": "96",
  "tt7504726": "Kannum Kannum Kollaiyadithaal",
  "tt9032400": "Karnan",
  "tt6719968": "Mersal",
  "tt9032398": "Thiruchitrambalam",
  "tt15671028": "Viduthalai Part 1",
  "tt12412888": "Valimai",
  "tt16365614": "Raayan",
  "tt11035246": "Beast",
  "tt10837246": "Ratsasan",
  "tt3263904": "Kaala",
  "tt13700266": "Ponniyin Selvan II",
  "tt15854528": "Viduthalai Part 2",
  "tt14899400": "Thunivu",
  "tt15245574": "Varisu",
  "tt14161718": "Etharkkum Thunindhavan",
  "tt16538956": "Ayalaan",
  "tt9032401": "Navarasa",
  "tt15256628": "Triples",
};

const VERIFIED_TAMIL_SERIES = {
  "tt8291224": "Suzhal The Vortex",
  "tt14519434": "Vadhandhi",
  "tt9032401": "Navarasa",
  "tt12077116": "Sarpatta Parambarai",
  "tt15256628": "Triples",
  "tt14444952": "Kalathil Santhippom",
  "tt11847842": "Six",
  "tt10954984": "Yaar Ival",
  "tt13615776": "Nenjam Marappathillai",
  "tt8291220": "Jugalbandi",
};

const PLATFORM_NAMES = {
  sunnxt: "Sun NXT", zee5: "ZEE5", jiohotstar: "JioHotstar",
  aha: "Aha Tamil", mxplayer: "Amazon MX Player",
  kalaignar: "Kalaignar TV", sonyliv: "Sony LIV",
};

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null;

  const cacheKey = `${platform}_${subtype}`;
  const cached = geminiCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const platformName = PLATFORM_NAMES[platform] || platform;
  const isMovie = subtype === "movies" || subtype === "shorts";
  const verifiedList = isMovie ? VERIFIED_TAMIL_MOVIES : VERIFIED_TAMIL_SERIES;
  const listJson = JSON.stringify(verifiedList, null, 2);

  const prompt = `You are an expert on Tamil cinema and Indian OTT platforms.

Here is a list of verified Tamil movies/shows with their IMDB IDs:
${listJson}

From this list ONLY, select exactly 15 titles that are most likely available on ${platformName} in India.
- Sun NXT: specializes in Sun TV Network content, Rajinikanth films, Vijay films
- ZEE5: known for Vijay Sethupathi films, arthouse Tamil cinema
- JioHotstar: blockbusters, Amazon Prime originals, big budget films
- Aha Tamil: Tamil originals, newer releases
- Sony LIV: critically acclaimed films, award winners
- Kalaignar TV: older classics, Vijay TV productions
- Amazon MX Player: free content, popular mainstream films

Return ONLY a JSON array of IMDB IDs from the list above. No other text.
Example: ["tt6016236","tt15655792","tt8143610"]`;

  try {
    console.log(`[Gemini] Querying ${platformName} ${subtype}...`);
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
      }),
      timeout: 15000,
    });

    if (!res.ok) { console.error(`[Gemini] ${res.status}`); return null; }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`[Gemini] Response: ${text.slice(0,200)}`);

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;

    const ids = JSON.parse(match[0]);
    if (!Array.isArray(ids) || ids.length === 0) return null;

    // STRICT: only allow IDs from our verified list
    const valid = ids.filter(id => verifiedList[id]);
    console.log(`[Gemini] ${valid.length} verified IDs for ${cacheKey}`);

    if (valid.length < 5) return null;

    geminiCache.set(cacheKey, { data: valid, ts: Date.now() });
    return valid;

  } catch (err) {
    console.error(`[Gemini] Error:`, err.message);
    return null;
  }
}

module.exports = { askGemini };
