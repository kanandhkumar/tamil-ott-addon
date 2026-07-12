const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function getWeeklyTamilOttReleases() {
  try {
    console.log("🧠 Fetching Tamil OTT releases from the last 21 days...");

    const prompt = `
Search the live web using Google Search.

Find EVERY movie or web series that became available during the last 21 days on these OTT platforms in India:

- Netflix India
- Prime Video India
- JioHotstar
- SonyLIV
- ZEE5
- SunNXT
- Aha

Include:
- Tamil original movies and series
- Telugu titles with Tamil audio
- Hindi titles with Tamil audio
- Malayalam titles with Tamil audio
- Kannada titles with Tamil audio
- English titles with Tamil audio

Exclude:
- Theatrical releases
- Titles not yet streaming
- Titles without Tamil audio

Return ONLY valid JSON.
Do not use markdown.
Do not explain anything.

Format:

[
  {
    "title": "Movie Name",
    "platform": "Netflix",
    "original_language": "Telugu",
    "release_date": "2026-07-01"
  }
]
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    let text = (response.text || "").trim();

    // Remove markdown if Gemini accidentally adds it
    text = text
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ Failed to parse Gemini response:");
      console.error(text);

      return {
        articleUrl: "Parse Error",
        releases: [],
      };
    }

    if (!Array.isArray(data)) {
      console.error("❌ Gemini did not return an array.");

      return {
        articleUrl: "Unexpected Response",
        releases: [],
      };
    }

    return {
      articleUrl: "Generated via Google Search Grounding",

      releases: data.map((movie) => ({
        title: movie.title || "Unknown",
        platform: movie.platform || "Unknown",
        originalLanguage: movie.original_language || "Unknown",
        date:
          movie.release_date ||
          new Date().toISOString().split("T")[0],

        languages:
          movie.original_language === "Tamil"
            ? ["Tamil"]
            : [movie.original_language || "Unknown", "Tamil"],

        raw:
          movie.original_language === "Tamil"
            ? `Tamil original • ${movie.platform}`
            : `${movie.original_language} (Tamil audio) • ${movie.platform}`,
      })),
    };
  } catch (error) {
    console.error("❌ Gemini API Error");
    console.error(error);

    return {
      articleUrl: "Error",
      releases: [],
    };
  }
}

module.exports = {
  getWeeklyTamilOttReleases,
};