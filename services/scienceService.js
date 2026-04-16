const axios = require("axios")
require("dotenv").config()

const REQUEST_TIMEOUT_MS = 12000

function getLocalScienceFallback() {
  const now = new Date().toISOString()
  return [
    {
      title: "Clinical Research Teams Refine Biomarker-Led Trials",
      description: "Researchers are using more precise biomarker signals to improve trial targeting and outcome interpretation.",
      url: "",
      content: "The approach helps teams evaluate therapies faster and match treatments more accurately to patient groups.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Space Observation Networks Improve Early Hazard Analysis",
      description: "Astronomy teams are improving detection pipelines for near-Earth objects and unusual sky events.",
      url: "",
      content: "Better filtering and coordination between observatories are helping researchers respond faster to high-value observations.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    }
  ]
}

async function scienceService() {
  const scienceQuery = "scientific research OR clinical trial OR space telescope OR genomics OR physics OR biology OR neuroscience"
  const scienceDomains = [
    "nature.com",
    "scientificamerican.com",
    "sciencedaily.com",
    "newscientist.com",
    "phys.org",
    "livescience.com",
    "nih.gov",
    "nasa.gov"
  ].join(",")
  const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(scienceQuery)}&domains=${encodeURIComponent(scienceDomains)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${process.env.NEWS_API_KEY}`

  try {
    const newsResponse = await axios.get(newsUrl, { timeout: REQUEST_TIMEOUT_MS })
    const articles = (newsResponse.data?.articles || []).map((article) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      content: article.content,
      image: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source?.name || "Unknown source"
    })).filter((article) => article.title || article.description)

    if (articles.length >= 2) {
      return articles
    }
  } catch (error) {
    console.error("Science NewsAPI fetch failed:", error.response?.data || error.message)
  }

  const nasaUrl = `https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}&count=2`
  try {
    const nasaResponse = await axios.get(nasaUrl, { timeout: REQUEST_TIMEOUT_MS })

    return (nasaResponse.data || []).map((item) => ({
      title: item.title,
      description: item.explanation,
      url: item.url,
      content: item.explanation,
      image: item.media_type === "image" ? item.url : "",
      publishedAt: item.date,
      source: "NASA"
    }))
  } catch (error) {
    console.error("Science NASA fallback failed:", error.response?.data || error.message)
    return getLocalScienceFallback()
  }
}

module.exports = scienceService
