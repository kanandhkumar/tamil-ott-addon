const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PROMPT = `Search the live web thoroughly and list EVERY movie or series that became newly available on major OTT platforms in India (Netflix, Prime Video, Hotstar/JioHotstar, Aha, SunNXT, ZEE5, SonyLIV) within the last 21 days, where a TAMIL audio/language option exists.

Be exhaustive — check FilmiBeat, Cinema Express, The Hindu, Times of India, Pinkvilla, Bollywood Hungama, and OTTplay for weekly OTT release roundups, not just the single most prominent title on each platform.

Include ALL of the following, regardless of original language or genre:
- Movies originally made in Tamil
- Movies/series originally in Telugu, Hindi, Malayalam, Kannada, or English that are dubbed in Tamil or have a Tamil audio track available on the platform (e.g. a Hindi courtroom drama or a small-budget regional film with a Tamil dub counts just as much as a big-budget release)
- Smaller/regional films and straight-to-OTT titles, not just widely publicized ones
- Web series and documentaries, not just feature films

Do NOT filter by original language — filter only by whether Tamil audio is available to viewers.
Do NOT limit yourself to only the most popular or most-covered titles — aim for a complete list, typically 15-25 titles in a normal week.
Do NOT include duplicate entries for the same title.
Do NOT include movies that are only in theaters with no confirmed OTT date yet.
Return the result strictly as a JSON array of objects. Each object must have a "title" string, a "platform" string, and an "original_language" string (e.g. "Tamil", "Telugu", "Hindi").
Do not include markdown formatting, code fences, or any text outside the JSON array.`;

// One attempt at calling Gemini and parsing its response into a raw title array.
// Throws on any failure (network, bad JSON, wrong shape) so the caller can retry.
async function attemptFetch(attemptNumber) {
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: PROMPT,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            temperature: 0.2 // lower temperature = more consistent, less creative-drift output
        }
    });

    const rawText = (response.text || "").trim();
    const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!cleanText) {
        throw new Error(`Empty response on attempt ${attemptNumber}`);
    }

    const data = JSON.parse(cleanText); // throws if not valid JSON

    if (!Array.isArray(data)) {
        throw new Error(`Response was not a JSON array on attempt ${attemptNumber}`);
    }

    return data;
}

// Remove duplicate titles (case-insensitive, ignoring whitespace differences)
function dedupeByTitle(items) {
    const seen = new Set();
    const result = [];
    for (const movie of items) {
        if (!movie || !movie.title) continue;
        const key = movie.title.trim().toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(movie);
    }
    return result;
}

async function getWeeklyTamilOttReleases() {
    const MAX_ATTEMPTS = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            console.log(`🧠 Fetching Tamil OTT releases via Gemini (attempt ${attempt}/${MAX_ATTEMPTS})...`);
            const rawData = await attemptFetch(attempt);
            const data = dedupeByTitle(rawData);

            console.log(`✅ Gemini returned ${rawData.length} titles (${data.length} after dedup)`);

            return {
                articleUrl: "Generated via Google Search Grounding",
                releases: data.map(movie => ({
                    title: movie.title,
                    platform: movie.platform || "OTT",
                    originalLanguage: movie.original_language || "Tamil",
                    date: new Date().toISOString().split('T')[0],
                    languages: ["Tamil"],
                    raw: `Sourced via Gemini AI • ${movie.original_language && movie.original_language !== "Tamil" ? movie.original_language + " (Tamil dub) " : ""}on ${movie.platform}`
                }))
            };
        } catch (e) {
            lastError = e;
            console.error(`⚠️ Gemini attempt ${attempt} failed: ${e.message}`);
            if (attempt < MAX_ATTEMPTS) {
                console.log("🔄 Retrying...");
            }
        }
    }

    console.error(`❌ Gemini API Error after ${MAX_ATTEMPTS} attempts:`, lastError ? lastError.message : "unknown error");
    return { articleUrl: "Error", releases: [] };
}

module.exports = { getWeeklyTamilOttReleases };
