const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Gemini's ONLY job now: name candidate titles. No platform, no date, no language claims —
// all of that is unreliable from Gemini and gets verified against TMDB in index.js instead.
const PROMPT = `Search the live web thoroughly and list movies or series that became newly available on OTT platforms in India within the last 21 days, where a Tamil audio/dubbed option exists (this includes Tamil-original films AND Telugu/Hindi/Malayalam/Kannada/English films with a Tamil dub).

Be exhaustive — check FilmiBeat, Cinema Express, The Hindu, OTTplay, and similar sources for weekly OTT roundups. Include smaller/regional titles, not just the most publicized ones.

Return ONLY a JSON array of strings — just the movie/series titles, nothing else. Example: ["Title One", "Title Two", "Title Three"]
Do not include markdown formatting, code fences, platform names, or any other text — just the plain JSON array of title strings.
Do not include duplicate titles.`;

async function attemptFetch(attemptNumber) {
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: PROMPT,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            temperature: 0.2
        }
    });

    const rawText = (response.text || "").trim();
    const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!cleanText) {
        throw new Error(`Empty response on attempt ${attemptNumber}`);
    }

    const data = JSON.parse(cleanText);

    if (!Array.isArray(data)) {
        throw new Error(`Response was not a JSON array on attempt ${attemptNumber}`);
    }

    return data;
}

function dedupeTitles(titles) {
    const seen = new Set();
    const result = [];
    for (const t of titles) {
        if (!t || typeof t !== 'string') continue;
        const key = t.trim().toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key) || !key) continue;
        seen.add(key);
        result.push(t.trim());
    }
    return result;
}

// Returns just a list of candidate title strings — no metadata.
// index.js is responsible for verifying each title against TMDB (recency, real existence, etc.)
async function getWeeklyTamilOttTitles() {
    const MAX_ATTEMPTS = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            console.log(`🧠 Fetching candidate Tamil OTT titles via Gemini (attempt ${attempt}/${MAX_ATTEMPTS})...`);
            const rawTitles = await attemptFetch(attempt);
            const titles = dedupeTitles(rawTitles);
            console.log(`✅ Gemini returned ${rawTitles.length} titles (${titles.length} after dedup)`);
            return titles;
        } catch (e) {
            lastError = e;
            console.error(`⚠️ Gemini attempt ${attempt} failed: ${e.message}`);
            if (attempt < MAX_ATTEMPTS) console.log("🔄 Retrying...");
        }
    }

    console.error(`❌ Gemini API Error after ${MAX_ATTEMPTS} attempts:`, lastError ? lastError.message : "unknown error");
    return [];
}

module.exports = { getWeeklyTamilOttTitles };
