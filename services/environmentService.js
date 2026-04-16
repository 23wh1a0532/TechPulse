const axios = require("axios")
require("dotenv").config()
const { fetchRssArticles } = require("../utils/rssFallback")

const REQUEST_TIMEOUT_MS = 12000

function getLocalEnvironmentFallback() {
  const now = new Date().toISOString()
  return [
    {
      title: "Cities Expand Heat-Resilient Infrastructure Plans",
      description: "Urban planners are accelerating tree-canopy, cool-roof, and water-retention projects to reduce climate-driven heat risk.",
      url: "",
      content: "Urban climate adaptation programs are focusing on practical upgrades that improve resilience across transportation, housing, and public spaces.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Grid Operators Increase Renewable Storage Pilots",
      description: "Utilities are pairing battery systems with solar and wind assets to smooth demand peaks and improve stability.",
      url: "",
      content: "Energy teams are scaling storage pilots and forecasting tools to improve reliability during high-demand periods.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Water Monitoring Sensors Improve Early Alerts",
      description: "Regional agencies are deploying connected monitoring systems to detect contamination and scarcity trends earlier.",
      url: "",
      content: "Environmental monitoring projects are using IoT sensors to improve response times and inform long-term water strategy.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    }
  ]
}

function mapGnewsArticle(a) {
  return {
    title: a.title,
    description: a.description,
    url: a.url,
    content: a.content,
    image: a.image,
    publishedAt: a.publishedAt,
    source: a.source?.name || "Unknown source"
  }
}

function mapNewsApiArticle(a) {
  return {
    title: a.title,
    description: a.description,
    url: a.url,
    content: a.content,
    image: a.urlToImage,
    publishedAt: a.publishedAt,
    source: a.source?.name || "Unknown source"
  }
}

async function environmentService() {
  const gnewsUrl = `https://gnews.io/api/v4/search?q=climate OR renewable energy OR sustainability&lang=en&max=5&apikey=${process.env.GNEWS_API_KEY}`

  try {
    const gnewsResponse = await axios.get(gnewsUrl, { timeout: REQUEST_TIMEOUT_MS })
    const gnewsArticles = (gnewsResponse.data?.articles || []).map(mapGnewsArticle)

    if (gnewsArticles.length) {
      return gnewsArticles
    }
  } catch (error) {
    console.error("Environment GNews fetch failed:", error.response?.data || error.message)
  }

  const newsApiUrl = `https://newsapi.org/v2/everything?q=climate OR renewable energy OR sustainability&language=en&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`

  try {
    const newsApiResponse = await axios.get(newsApiUrl, { timeout: REQUEST_TIMEOUT_MS })
    const newsApiArticles = (newsApiResponse.data?.articles || []).map(mapNewsApiArticle)
    if (newsApiArticles.length) {
      return newsApiArticles
    }
  } catch (error) {
    console.error("Environment NewsAPI fallback failed:", error.response?.data || error.message)
  }

  const rssUrl = "https://news.google.com/rss/search?q=climate+OR+renewable+energy+OR+sustainability&hl=en-US&gl=US&ceid=US:en"
  try {
    return await fetchRssArticles(rssUrl, 5)
  } catch (error) {
    console.error("Environment RSS fallback failed:", error.response?.data || error.message)
    return getLocalEnvironmentFallback()
  }
}

module.exports = environmentService
