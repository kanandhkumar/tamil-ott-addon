const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWeeklyTamilOttReleases() {
    try {
        console.log("🧠 Fetching 3 weeks of OTT releases via Gemini...");
        
        const prompt = `Search the live web for movies or series newly available on major OTT platforms in India (Netflix, Prime Video, Hotstar/JioHotstar, Aha, SunNXT, ZEE5, SonyLIV) within the last 21 days, where a TAMIL audio/language option exists.
        Include ALL of the following: movies originally made in Tamil, AND movies/series originally in Telugu, Hindi, Malayalam, Kannada, or English that are dubbed in Tamil or have a Tamil audio track available on the platform.
        Do NOT filter by original language — filter only by whether Tamil audio is available to viewers.
        Return the result strictly as a JSON array of objects. Each object must have a "title" string, a "platform" string, and an "original_language" string (e.g. "Tamil", "Telugu", "Hindi").
        Do not include movies that are only in theaters. Do not include markdown formatting.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], 
                responseMimeType: "application/json"
            }
        });

        const rawText = (response.text || "").trim();
        const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const data = JSON.parse(cleanText);

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
        console.error("❌ Gemini API Error:", e.message);
        return { articleUrl: "Error", releases: [] };
    }
}

module.exports = { getWeeklyTamilOttReleases };
