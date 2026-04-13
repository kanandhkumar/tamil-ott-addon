const fetch = require("node-fetch");

const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const PLATFORMS = ["Netflix", "Amazon Prime Video", "Sun NXT", "Aha Tamil", "ZEE5"];

async function askGemini(platformRequested, subtype) {
  if (!GEMINI_KEY) return null;

  // We are starting with 4 major recent Tamil hits to test the allocation logic
  const testMovies = ["Maharaja (2024)", "Raayan (2024)", "Thiruchitrambalam", "Kottai Pattinam"];

  const prompt = `Act as a streaming database. For these 4 Tamil movies: ${testMovies.join(", ")}, 
  identify which ONE of these platforms they are currently streaming on in India: ${PLATFORMS.join(", ")}.
  
  Return ONLY a JSON object where the keys are the platform names (lowercase, e.g., "aha") and the values are arrays of their IMDB IDs.
  Example: {"aha": ["tt1234567"], "netflix": ["tt7654321"]}
  
  Only include movies that belong to the platform: "${platformRequested}".`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }] // Uses Google Search to verify the current OTT home
      })
    });

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const allocation = JSON.parse(match[0]);
    // Return only the IDs for the platform Stremio is currently asking for
    const platformKey = platformRequested.toLowerCase().split(" ")[0];
    return allocation[platformKey] || allocation[platformRequested] || [];
  } catch (e) {
    return null;
  }
}

module.exports = { askGemini };
