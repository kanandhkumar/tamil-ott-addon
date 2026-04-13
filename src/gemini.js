const fetch = require("node-fetch");

const GEMINI_KEY = process.env.GEMINI_API_KEY; 
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function askGemini(platform, subtype) {
  if (!GEMINI_KEY) return null;

  const prompt = `Return a JSON array of IMDB IDs for popular Tamil ${subtype} on ${platform} India. 
  Format: ["tt1234567", "tt7654321"]`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { return null; }
}

module.exports = { askGemini };
