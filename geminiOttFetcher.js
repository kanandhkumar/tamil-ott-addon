const { GoogleGenAI } = require('@google/genai');

// Securely loads your API key from your environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWeeklyTamilOttReleases() {
    try {
        console.log("🧠 Fetching expanded list from Filmibeat via Gemini...");
        
        // Updated prompt to ensure a robust list of 30+ items
        const prompt = `Visit https://tamil.filmibeat.com/ott/ and extract all movies listed in the 'Table of Content' or main release list for the last 21 days.
        Return the result strictly as a JSON array of at least 30 objects. Each object must have a "title" string and a "platform" string. 
        Do not include movies that are only in theaters. Do not include markdown formatting.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], 
                responseMimeType: "application/json"
            }
        });

        // FIXED: Added () to .text() to correctly execute the function
        const data = JSON.parse(response.text());

        return { 
            articleUrl: "https://tamil.filmibeat.com/ott/", 
            releases: data.map(movie => ({
                title: movie.title,
                platform: movie.platform || "OTT",
                date: new Date().toISOString().split('T')[0],
                languages: ["Tamil"],
                raw: `Sourced via Gemini AI • Found on Filmibeat`
            }))
        };
        
    } catch (e) {
        console.error("❌ Gemini API Error:", e.message);
        return { articleUrl: "Error", releases: [] };
    }
}

module.exports = { getWeeklyTamilOttReleases };
