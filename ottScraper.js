const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36"
};

async function scrapeFilmibeat() {
  try {
    const { data } = await axios.get(
      "https://www.filmibeat.com/tamil/ott/",
      {
        headers: HEADERS,
        timeout: 15000
      }
    );

    const $ = cheerio.load(data);
    const results = [];

    $("h2, h3, h4, .article-title, .news-title").each((_, el) => {
      const title = $(el).text().trim();

      if (
        title.length > 2 &&
        title.length < 100 &&
        !results.includes(title)
      ) {
        results.push(title);
      }
    });

    return results;
  } catch (err) {
    console.error("Filmibeat:", err.message);
    return [];
  }
}

async function scrapeOttPlay() {
  try {
    const { data } = await axios.get(
      "https://www.ottplay.com/",
      {
        headers: HEADERS,
        timeout: 15000
      }
    );

    const $ = cheerio.load(data);
    const results = [];

    $("h2, h3, h4").each((_, el) => {
      const title = $(el).text().trim();

      if (
        title.length > 2 &&
        title.length < 100 &&
        !results.includes(title)
      ) {
        results.push(title);
      }
    });

    return results;
  } catch (err) {
    console.error("OTTPlay:", err.message);
    return [];
  }
}

async function getScrapedTitles() {
  const [filmibeat, ottplay] = await Promise.all([
    scrapeFilmibeat(),
    scrapeOttPlay()
  ]);

  const combined = [...filmibeat, ...ottplay];

  return [...new Set(combined)];
}

module.exports = {
  getScrapedTitles
};