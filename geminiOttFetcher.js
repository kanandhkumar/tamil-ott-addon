const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWeeklyTamilOttReleases() {
    try {
        console.log("🧠 Fetching 30+ OTT releases via Gemini...");
        
        // Explicitly demanding 30 results and providing fallback search instructions
        const prompt = `Search the live web for movies or series newly available on major OTT platforms in India (Netflix, Prime Video, JioHotstar, Aha, SunNXT, ZEE5, SonyLIV) within the last 21 days that have a TAMIL audio/language option available.
        This includes movies originally in Tamil, and dubbed versions in Tamil of Telugu, Hindi, Malayalam, Kannada, or English titles.
        REQUIREMENT: You must provide a list of AT LEAST 30 unique titles. If you cannot find 30 from the last 21 days, include the most recent notable Tamil OTT releases from the last 45 days until you reach 30.
        Return the result strictly as a JSON array of objects. Each object must have a "title" string, a "platform" string, and an "original_language" string.
        Do not include theatrical-only releases. Do not include markdown formatting or extra text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], 
                responseMimeType: "application/json"
            }
        });

        // Use the function call response.text()
        const rawText = (response.text() || "").trim();
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
