const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWeeklyTamilOttReleases() {
    try {
        console.log("🧠 Fetching 3 weeks of OTT releases via Gemini...");
        
        const prompt = `Search the live web for Tamil movies or series released on major OTT platforms (Netflix, Prime Video, Hotstar, Aha, SunNXT, ZEE5, SonyLIV) within the last 21 days. 
        Return the result strictly as a JSON array of objects. Each object must have a "title" string and a "platform" string. 
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
                date: new Date().toISOString().split('T')[0],
                languages: ["Tamil"],
                raw: `Sourced via Gemini AI • Released on ${movie.platform}`
            }))
        };
        
    } catch (e) {
        console.error("❌ Gemini API Error:", e.message);
        return { articleUrl: "Error", releases: [] };
    }
}

module.exports = { getWeeklyTamilOttReleases };
